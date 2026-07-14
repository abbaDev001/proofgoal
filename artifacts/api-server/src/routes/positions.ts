import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, marketsTable, positionsTable } from "@workspace/db";
import {
  ListPositionsQueryParams,
  ListPositionsResponse,
  CreatePositionBody,
  CreatePositionResponse,
  GetPositionParams,
  GetPositionResponse,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { sendPayout, isTreasuryConfigured } from "../lib/payout";
import { verifySolanaTransfer } from "../lib/verifyTransfer";

const router: IRouter = Router();

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/positions", async (req, res): Promise<void> => {
  const parsed = ListPositionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const positions = await db
    .select()
    .from(positionsTable)
    .where(eq(positionsTable.walletAddress, parsed.data.walletAddress))
    .orderBy(positionsTable.placedAt);

  res.json(ListPositionsResponse.parse(positions));
});

router.post("/positions", async (req, res): Promise<void> => {
  const txSignature =
    typeof req.body?.txSignature === "string" ? (req.body.txSignature as string) : undefined;

  const parsed = CreatePositionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const positionData = parsed.data;

  const [market] = await db
    .select()
    .from(marketsTable)
    .where(eq(marketsTable.id, positionData.marketId));

  if (!market) {
    res.status(404).json({ error: "Market not found" });
    return;
  }
  if (market.status !== "open") {
    res.status(400).json({ error: "Market is not open for new positions" });
    return;
  }

  const selection = market.selections.find((s) => s.id === positionData.selectionId);
  if (!selection) {
    res.status(404).json({ error: "Selection not found in market" });
    return;
  }

  const treasuryWallet = process.env["TREASURY_WALLET_PUBKEY"];
  if (txSignature && treasuryWallet) {
    try {
      await verifySolanaTransfer(
        txSignature,
        positionData.walletAddress,
        treasuryWallet,
        positionData.stakeLamports,
      );
    } catch (err) {
      logger.warn({ err, txSignature }, "On-chain tx verification failed");
      res.status(400).json({
        error: `Transaction verification failed: ${(err as Error).message}`,
      });
      return;
    }
  }

  const potentialPayoutLamports = Math.round(
    positionData.stakeLamports * selection.odds,
  );

  const [created] = await db
    .insert(positionsTable)
    .values({
      walletAddress: positionData.walletAddress,
      marketId: positionData.marketId,
      selectionId: positionData.selectionId,
      stakeLamports: positionData.stakeLamports,
      potentialPayoutLamports,
      settlementTxSig: txSignature ?? null,
    })
    .returning();

  await db
    .update(marketsTable)
    .set({ liquidityLamports: market.liquidityLamports + positionData.stakeLamports })
    .where(eq(marketsTable.id, market.id));

  res.status(201).json(CreatePositionResponse.parse(created));
});

router.get("/positions/:positionId", async (req, res): Promise<void> => {
  const params = GetPositionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [position] = await db
    .select()
    .from(positionsTable)
    .where(eq(positionsTable.id, params.data.positionId));

  if (!position) {
    res.status(404).json({ error: "Position not found" });
    return;
  }

  res.json(GetPositionResponse.parse(position));
});

// ── Claim payout ──────────────────────────────────────────────────────────────
/**
 * POST /api/positions/:positionId/claim
 * Body: { walletAddress: string }
 *
 * Sends the payout for a won position to the user's wallet.
 * The position is updated to "claimed" with the payout tx signature.
 */
router.post("/positions/:positionId/claim", async (req, res): Promise<void> => {
  const positionId = req.params.positionId as string;
  const walletAddress = req.body?.walletAddress as string | undefined;

  if (!positionId || !walletAddress) {
    res.status(400).json({ error: "positionId and walletAddress are required" });
    return;
  }

  if (!isTreasuryConfigured()) {
    res.status(503).json({ error: "Treasury payout is not configured on this server." });
    return;
  }

  const [position] = await db
    .select()
    .from(positionsTable)
    .where(
      and(
        eq(positionsTable.id, positionId),
        eq(positionsTable.walletAddress, walletAddress),
      ),
    );

  if (!position) {
    res.status(404).json({ error: "Position not found or does not belong to this wallet" });
    return;
  }

  if (position.status !== "won") {
    res.status(400).json({
      error: `Cannot claim: position status is "${position.status}". Only won positions can be claimed.`,
    });
    return;
  }

  try {
    const payoutLamports = position.potentialPayoutLamports;
    const payoutSig = await sendPayout(walletAddress, payoutLamports);

    await db
      .update(positionsTable)
      .set({ status: "claimed", payoutTxSig: payoutSig, settledAt: new Date() })
      .where(eq(positionsTable.id, positionId));

    logger.info({ positionId, walletAddress, payoutLamports, payoutSig }, "Payout claimed");
    res.json({ success: true, payoutTxSig: payoutSig, payoutLamports });
  } catch (err) {
    logger.error({ err, positionId, walletAddress }, "Payout failed");
    res.status(502).json({
      error: `Payout failed: ${(err as Error).message}`,
    });
  }
});

export default router;
