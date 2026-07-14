/**
 * Admin routes — platform management for ProofGoal operators.
 * Protected by ADMIN_SECRET env variable (checked via X-Admin-Key header or ?adminKey= query).
 * If ADMIN_SECRET is not set, any request is allowed (dev mode).
 */
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, count, and } from "drizzle-orm";
import {
  db,
  matchesTable,
  marketsTable,
  positionsTable,
  insuranceProductsTable,
  insurancePoliciesTable,
  governanceProposalsTable,
  liquidityPoolsTable,
  proofRecordsTable,
} from "@workspace/db";
import { syncMatchesFromTxline, createDefaultMarketsForMatch, settleMarket, generateProofAndSettle } from "../lib/txline";
import crypto from "crypto";

const router: IRouter = Router();

// ── Auth middleware ────────────────────────────────────────────────────────────
function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env["ADMIN_SECRET"];
  if (!secret) { next(); return; } // no secret set → open in dev
  const key = req.headers["x-admin-key"] || req.query["adminKey"];
  if (key !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.use("/admin", adminAuth);

// ── Stats overview ─────────────────────────────────────────────────────────────
router.get("/admin/stats", async (_req, res): Promise<void> => {
  const [[matches], [markets], [positions], [products], [policies], [proposals], [proofs]] =
    await Promise.all([
      db.select({ value: count() }).from(matchesTable),
      db.select({ value: count() }).from(marketsTable),
      db.select({ value: count() }).from(positionsTable),
      db.select({ value: count() }).from(insuranceProductsTable),
      db.select({ value: count() }).from(insurancePoliciesTable),
      db.select({ value: count() }).from(governanceProposalsTable),
      db.select({ value: count() }).from(proofRecordsTable),
    ]);

  const [openMarkets] = await db
    .select({ value: count() })
    .from(marketsTable)
    .where(eq(marketsTable.status, "open"));

  const [settledMarkets] = await db
    .select({ value: count() })
    .from(marketsTable)
    .where(eq(marketsTable.status, "settled"));

  res.json({
    matches: matches?.value ?? 0,
    markets: markets?.value ?? 0,
    openMarkets: openMarkets?.value ?? 0,
    settledMarkets: settledMarkets?.value ?? 0,
    positions: positions?.value ?? 0,
    insuranceProducts: products?.value ?? 0,
    insurancePolicies: policies?.value ?? 0,
    governanceProposals: proposals?.value ?? 0,
    proofs: proofs?.value ?? 0,
  });
});

// ── TxLINE sync ────────────────────────────────────────────────────────────────
router.post("/admin/sync", async (_req, res): Promise<void> => {
  const result = await syncMatchesFromTxline();
  res.json(result);
});

// ── Create markets for all fixtures that don't have them ──────────────────────
router.post("/admin/markets/create-all", async (_req, res): Promise<void> => {
  const matches = await db.select().from(matchesTable);
  let created = 0;
  for (const match of matches) {
    const existing = await db
      .select({ id: marketsTable.id })
      .from(marketsTable)
      .where(eq(marketsTable.matchId, match.id));
    if (existing.length === 0) {
      await createDefaultMarketsForMatch(match.id, match.homeTeam, match.awayTeam);
      created++;
    }
  }
  res.json({ created, message: `Created markets for ${created} fixture(s).` });
});

// ── Create markets for a specific fixture ─────────────────────────────────────
router.post("/admin/markets/create-for-fixture", async (req, res): Promise<void> => {
  const { matchId } = req.body as { matchId?: string };
  if (!matchId) { res.status(400).json({ error: "matchId required" }); return; }

  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }

  // Delete existing markets first if requested
  await createDefaultMarketsForMatch(match.id, match.homeTeam, match.awayTeam);

  const created = await db
    .select()
    .from(marketsTable)
    .where(eq(marketsTable.matchId, matchId));

  res.json({ created: created.length, markets: created });
});

// ── Create a custom market ─────────────────────────────────────────────────────
router.post("/admin/markets", async (req, res): Promise<void> => {
  const { matchId, type, title, selections } = req.body as {
    matchId?: string;
    type: string;
    title: string;
    selections: Array<{ label: string; odds: number }>;
  };

  if (!type || !title || !selections?.length) {
    res.status(400).json({ error: "type, title, and selections are required" });
    return;
  }

  const selectionsWithIds = selections.map((s) => ({
    id: crypto.randomUUID(),
    label: s.label,
    odds: Number(s.odds),
  }));

  const [created] = await db
    .insert(marketsTable)
    .values({ matchId: matchId ?? null, type: type as any, title, selections: selectionsWithIds })
    .returning();

  res.status(201).json(created);
});

// ── Settle a market ────────────────────────────────────────────────────────────
router.post("/admin/markets/:marketId/settle", async (req, res): Promise<void> => {
  const { marketId } = req.params;
  const { winningSelectionId } = req.body as { winningSelectionId?: string };

  if (!winningSelectionId) {
    res.status(400).json({ error: "winningSelectionId required" });
    return;
  }

  try {
    const result = await settleMarket(marketId, winningSelectionId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// ── Create insurance product ───────────────────────────────────────────────────
router.post("/admin/insurance/products", async (req, res): Promise<void> => {
  const { name, type, description, premiumRateBps, maxCoverageLamports, triggerCondition } =
    req.body as {
      name: string;
      type: string;
      description: string;
      premiumRateBps: number;
      maxCoverageLamports: number;
      triggerCondition: string;
    };

  if (!name || !type || !description || !premiumRateBps || !maxCoverageLamports || !triggerCondition) {
    res.status(400).json({ error: "All fields required" });
    return;
  }

  const [created] = await db
    .insert(insuranceProductsTable)
    .values({ name, type: type as any, description, premiumRateBps, maxCoverageLamports, triggerCondition })
    .returning();

  res.status(201).json(created);
});

// ── Create governance proposal ─────────────────────────────────────────────────
router.post("/admin/governance/proposals", async (req, res): Promise<void> => {
  const { title, description, endsAt } = req.body as {
    title: string;
    description: string;
    endsAt?: string;
  };

  if (!title || !description) {
    res.status(400).json({ error: "title and description are required" });
    return;
  }

  const [created] = await db
    .insert(governanceProposalsTable)
    .values({
      title,
      description,
      status: "active",
      endsAt: endsAt ? new Date(endsAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      votesFor: 0,
      votesAgainst: 0,
    })
    .returning();

  res.status(201).json(created);
});

// ── Create liquidity pool ──────────────────────────────────────────────────────
router.post("/admin/liquidity/pools", async (req, res): Promise<void> => {
  const { marketType, aprBps } = req.body as { marketType: string; aprBps: number };

  if (!marketType) {
    res.status(400).json({ error: "marketType required" });
    return;
  }

  const [created] = await db
    .insert(liquidityPoolsTable)
    .values({ marketType: marketType as any, aprBps: aprBps ?? 500, totalLiquidityLamports: 0, providerCount: 0 })
    .returning();

  res.status(201).json(created);
});

// ── Generate proof for a finished match ────────────────────────────────────────
router.post("/admin/proofs/generate", async (req, res): Promise<void> => {
  const { matchId } = req.body as { matchId?: string };
  if (!matchId) { res.status(400).json({ error: "matchId required" }); return; }

  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }

  await generateProofAndSettle(
    match.id,
    match.homeTeam,
    match.awayTeam,
    match.homeScore,
    match.awayScore,
  );

  const [proof] = await db
    .select()
    .from(proofRecordsTable)
    .where(eq(proofRecordsTable.matchId, matchId));

  res.json(proof ?? { message: "Proof generation attempted" });
});

export default router;
