import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  insuranceProductsTable,
  insurancePoliciesTable,
  matchesTable,
} from "@workspace/db";
import {
  ListInsuranceProductsQueryParams,
  ListInsuranceProductsResponse,
  CreateInsuranceProductBody,
  CreateInsuranceProductResponse,
  GetInsuranceProductParams,
  GetInsuranceProductResponse,
  ListInsurancePoliciesQueryParams,
  ListInsurancePoliciesResponse,
  PurchaseInsurancePolicyBody,
  PurchaseInsurancePolicyResponse,
  GetInsurancePolicyParams,
  GetInsurancePolicyResponse,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { sendPayout, isTreasuryConfigured } from "../lib/payout";
import { verifySolanaTransfer } from "../lib/verifyTransfer";

const router: IRouter = Router();

// Insurance product types that require matchId + selectedTeam
const MATCH_REQUIRED_TYPES = new Set([
  "favorite_team_loss",
  "tournament_exit",
  "qualification",
  "goal_insurance",
]);

router.get("/insurance/products", async (req, res): Promise<void> => {
  const parsed = ListInsuranceProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const products = await db
    .select()
    .from(insuranceProductsTable)
    .where(
      parsed.data.type
        ? eq(insuranceProductsTable.type, parsed.data.type)
        : undefined,
    )
    .orderBy(insuranceProductsTable.createdAt);

  res.json(ListInsuranceProductsResponse.parse(products));
});

router.post("/insurance/products", async (req, res): Promise<void> => {
  const parsed = CreateInsuranceProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [created] = await db
    .insert(insuranceProductsTable)
    .values(parsed.data)
    .returning();

  res.status(201).json(CreateInsuranceProductResponse.parse(created));
});

router.get(
  "/insurance/products/:productId",
  async (req, res): Promise<void> => {
    const params = GetInsuranceProductParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [product] = await db
      .select()
      .from(insuranceProductsTable)
      .where(eq(insuranceProductsTable.id, params.data.productId));

    if (!product) {
      res.status(404).json({ error: "Insurance product not found" });
      return;
    }

    res.json(GetInsuranceProductResponse.parse(product));
  },
);

router.get("/insurance/policies", async (req, res): Promise<void> => {
  const parsed = ListInsurancePoliciesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const policies = await db
    .select()
    .from(insurancePoliciesTable)
    .where(eq(insurancePoliciesTable.walletAddress, parsed.data.walletAddress))
    .orderBy(insurancePoliciesTable.purchasedAt);

  res.json(ListInsurancePoliciesResponse.parse(policies));
});

router.post("/insurance/policies", async (req, res): Promise<void> => {
  // Extract extra fields not in OpenAPI schema before Zod parsing
  const txSignature =
    typeof req.body?.txSignature === "string"
      ? (req.body.txSignature as string)
      : undefined;
  const selectedTeam =
    typeof req.body?.selectedTeam === "string"
      ? (req.body.selectedTeam as string)
      : undefined;

  const parsed = PurchaseInsurancePolicyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [product] = await db
    .select()
    .from(insuranceProductsTable)
    .where(eq(insuranceProductsTable.id, parsed.data.productId));

  if (!product) {
    res.status(404).json({ error: "Insurance product not found" });
    return;
  }

  // Validate matchId + selectedTeam for match-outcome-based products
  if (MATCH_REQUIRED_TYPES.has(product.type)) {
    if (!parsed.data.matchId) {
      res.status(400).json({ error: `Product type "${product.type}" requires a matchId` });
      return;
    }
    if (!selectedTeam) {
      res.status(400).json({ error: `Product type "${product.type}" requires a selectedTeam` });
      return;
    }

    // Verify selectedTeam matches one of the match teams
    const [match] = await db
      .select()
      .from(matchesTable)
      .where(eq(matchesTable.id, parsed.data.matchId));

    if (!match) {
      res.status(404).json({ error: "Match not found" });
      return;
    }

    if (selectedTeam !== match.homeTeam && selectedTeam !== match.awayTeam) {
      res.status(400).json({
        error: `selectedTeam must be "${match.homeTeam}" or "${match.awayTeam}"`,
      });
      return;
    }
  }

  if (parsed.data.coverageLamports > product.maxCoverageLamports) {
    res
      .status(400)
      .json({ error: "Requested coverage exceeds product maximum" });
    return;
  }

  const premiumPaidLamports = Math.round(
    (parsed.data.coverageLamports * product.premiumRateBps) / 10_000,
  );

  // On-chain premium payment verification
  const treasuryWallet = process.env["TREASURY_WALLET_PUBKEY"];
  if (txSignature && treasuryWallet) {
    const [reused] = await db
      .select()
      .from(insurancePoliciesTable)
      .where(eq(insurancePoliciesTable.premiumTxSig, txSignature));
    if (reused) {
      res.status(400).json({ error: "This transaction signature has already been used" });
      return;
    }
    try {
      await verifySolanaTransfer(
        txSignature,
        parsed.data.walletAddress,
        treasuryWallet,
        premiumPaidLamports,
      );
    } catch (err) {
      logger.warn({ err, txSignature }, "Insurance premium tx verification failed");
      res.status(400).json({
        error: `Transaction verification failed: ${(err as Error).message}`,
      });
      return;
    }
  }

  const [created] = await db
    .insert(insurancePoliciesTable)
    .values({
      walletAddress: parsed.data.walletAddress,
      productId: parsed.data.productId,
      matchId: parsed.data.matchId ?? null,
      selectedTeam: selectedTeam ?? null,
      premiumPaidLamports,
      coverageLamports: parsed.data.coverageLamports,
      premiumTxSig: txSignature ?? null,
    })
    .returning();

  res.status(201).json(PurchaseInsurancePolicyResponse.parse(created));
});

router.get(
  "/insurance/policies/:policyId",
  async (req, res): Promise<void> => {
    const params = GetInsurancePolicyParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [policy] = await db
      .select()
      .from(insurancePoliciesTable)
      .where(eq(insurancePoliciesTable.id, params.data.policyId));

    if (!policy) {
      res.status(404).json({ error: "Insurance policy not found" });
      return;
    }

    res.json(GetInsurancePolicyResponse.parse(policy));
  },
);

// ── Claim payout ──────────────────────────────────────────────────────────────
/**
 * POST /api/insurance/policies/:policyId/claim
 * Body: { walletAddress: string }
 *
 * Manual claim for a triggered insurance policy. Auto-claim is attempted at
 * settlement time; this endpoint handles the fallback case where treasury
 * was unfunded at settlement.
 */
router.post(
  "/insurance/policies/:policyId/claim",
  async (req, res): Promise<void> => {
    const policyId = req.params.policyId as string;
    const walletAddress = req.body?.walletAddress as string | undefined;

    if (!policyId || !walletAddress) {
      res.status(400).json({ error: "policyId and walletAddress are required" });
      return;
    }

    if (!isTreasuryConfigured()) {
      res.status(503).json({ error: "Treasury payout is not configured on this server." });
      return;
    }

    const [policy] = await db
      .select()
      .from(insurancePoliciesTable)
      .where(
        and(
          eq(insurancePoliciesTable.id, policyId),
          eq(insurancePoliciesTable.walletAddress, walletAddress),
        ),
      );

    if (!policy) {
      res.status(404).json({ error: "Policy not found or does not belong to this wallet" });
      return;
    }

    if (policy.status !== "triggered") {
      res.status(400).json({
        error: `Cannot claim: policy status is "${policy.status}". Only triggered policies can be claimed.`,
      });
      return;
    }

    try {
      const payoutLamports = policy.coverageLamports;
      const claimTxSig = await sendPayout(walletAddress, payoutLamports);

      await db
        .update(insurancePoliciesTable)
        .set({ status: "claimed", claimTxSig })
        .where(eq(insurancePoliciesTable.id, policyId));

      logger.info({ policyId, walletAddress, payoutLamports, claimTxSig }, "Insurance payout claimed");
      res.json({ success: true, claimTxSig, payoutLamports });
    } catch (err) {
      logger.error({ err, policyId, walletAddress }, "Insurance payout failed");
      res.status(502).json({
        error: `Payout failed: ${(err as Error).message}`,
      });
    }
  },
);

export default router;
