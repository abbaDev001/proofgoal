import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, governanceProposalsTable, votesTable } from "@workspace/db";
import {
  ListGovernanceProposalsQueryParams,
  ListGovernanceProposalsResponse,
  CreateGovernanceProposalBody,
  CreateGovernanceProposalResponse,
  GetGovernanceProposalParams,
  GetGovernanceProposalResponse,
  CastVoteParams,
  CastVoteBody,
  CastVoteResponse,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { sendPayout, isTreasuryConfigured } from "../lib/payout";
import { getWalletBalanceSol } from "../lib/solana";

const router: IRouter = Router();

const PARTICIPATION_REWARD_LAMPORTS = 1_000_000; // 0.001 SOL

router.get("/governance/proposals", async (req, res): Promise<void> => {
  const parsed = ListGovernanceProposalsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const proposals = await db
    .select()
    .from(governanceProposalsTable)
    .where(
      parsed.data.status
        ? eq(governanceProposalsTable.status, parsed.data.status)
        : undefined,
    )
    .orderBy(governanceProposalsTable.createdAt);

  res.json(ListGovernanceProposalsResponse.parse(proposals));
});

router.post("/governance/proposals", async (req, res): Promise<void> => {
  const parsed = CreateGovernanceProposalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [created] = await db
    .insert(governanceProposalsTable)
    .values(parsed.data)
    .returning();

  res.status(201).json(CreateGovernanceProposalResponse.parse(created));
});

router.get(
  "/governance/proposals/:proposalId",
  async (req, res): Promise<void> => {
    const params = GetGovernanceProposalParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [proposal] = await db
      .select()
      .from(governanceProposalsTable)
      .where(eq(governanceProposalsTable.id, params.data.proposalId));

    if (!proposal) {
      res.status(404).json({ error: "Proposal not found" });
      return;
    }

    res.json(GetGovernanceProposalResponse.parse(proposal));
  },
);

router.post(
  "/governance/proposals/:proposalId/votes",
  async (req, res): Promise<void> => {
    const params = CastVoteParams.safeParse(req.params);
    const body = CastVoteBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const [proposal] = await db
      .select()
      .from(governanceProposalsTable)
      .where(eq(governanceProposalsTable.id, params.data.proposalId));

    if (!proposal) {
      res.status(404).json({ error: "Proposal not found" });
      return;
    }

    if (proposal.status !== "active") {
      res.status(400).json({ error: "Proposal is not active" });
      return;
    }

    const [existingVote] = await db
      .select()
      .from(votesTable)
      .where(
        and(
          eq(votesTable.proposalId, params.data.proposalId),
          eq(votesTable.walletAddress, body.data.walletAddress),
        ),
      );

    if (existingVote) {
      res.status(400).json({ error: "Wallet has already voted on this proposal" });
      return;
    }

    // Fetch stake weight from Solana RPC; floor at MIN_WEIGHT_SOL on failure
    let weight = 0.01;
    try {
      weight = await getWalletBalanceSol(body.data.walletAddress);
    } catch (err) {
      logger.warn({ err, walletAddress: body.data.walletAddress }, "Failed to fetch SOL balance for vote weight; using floor");
    }

    const [created] = await db
      .insert(votesTable)
      .values({
        proposalId: params.data.proposalId,
        walletAddress: body.data.walletAddress,
        choice: body.data.choice,
        weight,
      })
      .returning();

    // Recalculate weighted totals via SQL SUM
    const [forRow] = await db
      .select({ total: sql<number>`coalesce(sum(${votesTable.weight}), 0)` })
      .from(votesTable)
      .where(
        and(
          eq(votesTable.proposalId, params.data.proposalId),
          eq(votesTable.choice, "for"),
        ),
      );
    const [againstRow] = await db
      .select({ total: sql<number>`coalesce(sum(${votesTable.weight}), 0)` })
      .from(votesTable)
      .where(
        and(
          eq(votesTable.proposalId, params.data.proposalId),
          eq(votesTable.choice, "against"),
        ),
      );

    await db
      .update(governanceProposalsTable)
      .set({
        votesFor: forRow?.total ?? 0,
        votesAgainst: againstRow?.total ?? 0,
      })
      .where(eq(governanceProposalsTable.id, params.data.proposalId));

    // Best-effort participation reward — never blocks the vote response
    let rewardSent = false;
    if (isTreasuryConfigured()) {
      try {
        await sendPayout(body.data.walletAddress, PARTICIPATION_REWARD_LAMPORTS);
        rewardSent = true;
        logger.info(
          { walletAddress: body.data.walletAddress, proposalId: params.data.proposalId, lamports: PARTICIPATION_REWARD_LAMPORTS },
          "Participation reward sent for vote",
        );
      } catch (err) {
        logger.warn(
          { err, walletAddress: body.data.walletAddress, proposalId: params.data.proposalId },
          "Participation reward failed; vote still recorded",
        );
      }
    }

    res.status(201).json({ ...CastVoteResponse.parse(created), rewardSent });
  },
);

export default router;
