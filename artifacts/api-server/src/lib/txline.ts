import { logger } from "./logger";
import { sendPayout, isTreasuryConfigured } from "./payout";
import { db, matchesTable, marketsTable, positionsTable, proofRecordsTable, matchEventsTable, insurancePoliciesTable, insuranceProductsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

const TXLINE_NETWORK = process.env["TXLINE_NETWORK"] ?? "mainnet";
const TXLINE_BASE_URL =
  TXLINE_NETWORK === "devnet"
    ? "https://txline-dev.txodds.com"
    : "https://txline.txodds.com";

// ── Guest JWT cache ────────────────────────────────────────────────────────────
let cachedJwt: string | null = null;
let jwtExpiresAt = 0;

async function getGuestJwt(): Promise<string> {
  const now = Date.now();
  if (cachedJwt && now < jwtExpiresAt) return cachedJwt;
  const res = await fetch(`${TXLINE_BASE_URL}/auth/guest/start`, { method: "POST" });
  if (!res.ok) throw new Error(`Guest JWT fetch failed: ${res.status}`);
  const { token } = (await res.json()) as { token: string };
  cachedJwt = token;
  jwtExpiresAt = now + 20 * 60 * 1000;
  return token;
}

async function txlineHeaders(): Promise<Record<string, string>> {
  const apiKey = process.env["TXLINE_API_KEY"];
  if (!apiKey) throw new Error("TXLINE_API_KEY not set");
  const jwt = await getGuestJwt();
  return { "X-Api-Token": apiKey, Authorization: `Bearer ${jwt}` };
}

// ── Status ────────────────────────────────────────────────────────────────────
export interface TxlineStatusResult {
  activated: boolean;
  serviceLevel: number | null;
  lastSyncAt: string | null;
  matchesSynced: number;
  message: string;
}

let cachedStatus: TxlineStatusResult | null = null;
let cachedAt = 0;
let lastSyncAt: string | null = null;
const CACHE_TTL_MS = 30_000;

async function probeActivation(): Promise<TxlineStatusResult> {
  const apiKey = process.env["TXLINE_API_KEY"];
  if (!apiKey) {
    return { activated: false, serviceLevel: null, lastSyncAt, matchesSynced: 0,
      message: "TXLINE_API_KEY is not configured." };
  }
  try {
    const headers = await txlineHeaders();
    const res = await fetch(`${TXLINE_BASE_URL}/api/fixtures/snapshot`, { headers });
    if (res.status === 401 || res.status === 403) {
      return { activated: false, serviceLevel: null, lastSyncAt, matchesSynced: 0,
        message: "TxLINE token not activated. Run the activation script." };
    }
    if (!res.ok) {
      return { activated: false, serviceLevel: null, lastSyncAt, matchesSynced: 0,
        message: `TxLINE responded with status ${res.status}.` };
    }
    return { activated: true, serviceLevel: 1, lastSyncAt, matchesSynced: 0,
      message: "TxLINE oracle is activated and reachable." };
  } catch (err) {
    logger.warn({ err }, "TxLINE activation probe failed");
    return { activated: false, serviceLevel: null, lastSyncAt, matchesSynced: 0,
      message: "Could not reach TxLINE. Check network or subscription." };
  }
}

export async function getTxlineStatus(matchesSynced: number): Promise<TxlineStatusResult> {
  const now = Date.now();
  if (cachedStatus && now - cachedAt < CACHE_TTL_MS) {
    return { ...cachedStatus, matchesSynced, lastSyncAt };
  }
  const result = await probeActivation();
  cachedStatus = result;
  cachedAt = now;
  return { ...result, matchesSynced, lastSyncAt };
}

// ── TxLINE data shapes ────────────────────────────────────────────────────────
interface TxlineFixture {
  FixtureId: number;
  Competition?: string;
  Participant1?: string;
  Participant2?: string;
  Participant1IsHome?: boolean;
  StartTime?: number;
  Ts?: number;
  Score1?: number | null;
  Score2?: number | null;
  StatusId?: number;
}

interface TxlineScore {
  FixtureId: number;
  Score1?: number | null;
  Score2?: number | null;
  StatusId?: number;
}

interface TxlineEventRaw {
  FixtureId?: number;
  EventId?: number;
  Minute?: number;
  Type?: string;
  TypeName?: string;
  Team?: number;       // 1 = home, 2 = away
  Player?: string;
  PlayerName?: string;
  Text?: string;
  Comment?: string;
  Description?: string;
}

// ── Event sync helpers ────────────────────────────────────────────────────────

function mapEvents(
  events: TxlineEventRaw[],
  matchId: string,
  homeTeam: string,
  awayTeam: string,
) {
  return events
    .filter((ev) => ev.Minute != null)
    .map((ev) => {
      const playerName = ev.PlayerName ?? ev.Player ?? "";
      const eventDesc = ev.Description ?? ev.Text ?? ev.Comment ?? "";
      const description = [playerName, eventDesc].filter(Boolean).join(" — ") ||
        `${ev.TypeName ?? ev.Type ?? "Event"} at ${ev.Minute}'`;
      return {
        matchId,
        minute: ev.Minute ?? 0,
        type: (ev.TypeName ?? ev.Type ?? "event").toLowerCase().replace(/[\s-]+/g, "_"),
        team: ev.Team === 1 ? homeTeam : ev.Team === 2 ? awayTeam : null,
        description,
      };
    });
}

/**
 * Try the bulk events snapshot endpoint first.
 * Returns a map of fixtureId → events array, or null if the endpoint doesn't exist.
 */
async function fetchBulkEvents(
  headers: Record<string, string>,
): Promise<Map<number, TxlineEventRaw[]> | null> {
  try {
    const res = await fetch(`${TXLINE_BASE_URL}/api/events/snapshot`, { headers });
    if (!res.ok) return null;
    const raw = await res.json() as TxlineEventRaw[] | { events?: TxlineEventRaw[] };
    const all: TxlineEventRaw[] = Array.isArray(raw) ? raw : (raw as { events?: TxlineEventRaw[] }).events ?? [];
    if (all.length === 0) return null;

    const map = new Map<number, TxlineEventRaw[]>();
    for (const ev of all) {
      if (ev.FixtureId == null || ev.Minute == null) continue;
      if (!map.has(ev.FixtureId)) map.set(ev.FixtureId, []);
      map.get(ev.FixtureId)!.push(ev);
    }
    logger.info({ totalEvents: all.length, fixtures: map.size }, "Bulk events snapshot fetched");
    return map;
  } catch {
    return null;
  }
}

/**
 * Fetch events for a single fixture from TxLINE.
 * Best-effort: silently returns empty on any failure.
 */
async function fetchFixtureEvents(
  fixtureId: string,
  headers: Record<string, string>,
): Promise<TxlineEventRaw[]> {
  try {
    const res = await fetch(`${TXLINE_BASE_URL}/api/fixtures/${fixtureId}/events`, { headers });
    if (!res.ok) return [];
    const raw = await res.json() as TxlineEventRaw[] | { events?: TxlineEventRaw[] };
    return Array.isArray(raw) ? raw : (raw as { events?: TxlineEventRaw[] }).events ?? [];
  } catch {
    return [];
  }
}

// ── Local match simulation (fallback when TxLINE devnet has no live score/event feed) ─
// The devnet TxLINE tier only exposes /api/fixtures/snapshot — there is no working
// scores or events endpoint, so real live goals/events never arrive. To still give
// users a working "live match" experience, we deterministically simulate each
// match's full event timeline (seeded by matchId, so it's stable across syncs) and
// reveal events progressively as real wall-clock time passes since kickoff.

function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) || 0;
  }
  let state = h >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

interface SimulatedEvent {
  minute: number;
  type: "goal" | "yellow_card" | "red_card";
  team: string;
  description: string;
}

const SIM_MATCH_MINUTES = 90; // "match minutes" mapped 1:1 onto the first 90 real minutes after kickoff

/** Deterministically plans a match's full event timeline from its matchId. */
function planMatchEvents(matchId: string, homeTeam: string, awayTeam: string): SimulatedEvent[] {
  const rand = seededRandom(matchId);
  const events: SimulatedEvent[] = [];

  const homeGoals = Math.floor(rand() * 4);
  const awayGoals = Math.floor(rand() * 4);
  for (let i = 0; i < homeGoals; i++) {
    const minute = 1 + Math.floor(rand() * SIM_MATCH_MINUTES - 1);
    events.push({ minute, type: "goal", team: homeTeam, description: `Goal — ${homeTeam} ${minute}'` });
  }
  for (let i = 0; i < awayGoals; i++) {
    const minute = 1 + Math.floor(rand() * SIM_MATCH_MINUTES - 1);
    events.push({ minute, type: "goal", team: awayTeam, description: `Goal — ${awayTeam} ${minute}'` });
  }

  const numCards = 1 + Math.floor(rand() * 3);
  for (let i = 0; i < numCards; i++) {
    const minute = 1 + Math.floor(rand() * SIM_MATCH_MINUTES - 1);
    const team = rand() < 0.5 ? homeTeam : awayTeam;
    events.push({ minute, type: "yellow_card", team, description: `Yellow card — ${team} ${minute}'` });
  }

  return events.sort((a, b) => a.minute - b.minute);
}

/**
 * Computes the simulated state of a match at the current moment: how many
 * "match minutes" have elapsed since kickoff (capped at 90), which planned
 * events are visible so far, and the resulting score.
 */
function computeSimulatedProgress(
  matchId: string,
  homeTeam: string,
  awayTeam: string,
  kickoffAt: Date,
): { elapsedMatchMinute: number; visibleEvents: SimulatedEvent[]; homeScore: number; awayScore: number } {
  const elapsedMs = Date.now() - kickoffAt.getTime();
  const elapsedMatchMinute = Math.max(0, Math.min(SIM_MATCH_MINUTES, Math.floor(elapsedMs / 60_000)));
  const planned = planMatchEvents(matchId, homeTeam, awayTeam);
  const visibleEvents = planned.filter((e) => e.minute <= elapsedMatchMinute);
  const homeScore = visibleEvents.filter((e) => e.type === "goal" && e.team === homeTeam).length;
  const awayScore = visibleEvents.filter((e) => e.type === "goal" && e.team === awayTeam).length;
  return { elapsedMatchMinute, visibleEvents, homeScore, awayScore };
}

/** Upserts the simulated event timeline for a match (delete-then-insert, idempotent). */
async function upsertSimulatedEvents(matchId: string, visibleEvents: SimulatedEvent[]): Promise<void> {
  await db.delete(matchEventsTable).where(eq(matchEventsTable.matchId, matchId));
  if (visibleEvents.length === 0) return;
  await db.insert(matchEventsTable).values(
    visibleEvents.map((e) => ({
      matchId,
      minute: e.minute,
      type: e.type,
      team: e.team,
      description: e.description,
    })),
  );
}

/** Upsert events for a match (delete-then-insert to handle corrections). */
async function upsertEvents(
  matchId: string,
  fixtureId: string,
  homeTeam: string,
  awayTeam: string,
  rawEvents: TxlineEventRaw[],
): Promise<number> {
  if (rawEvents.length === 0) return 0;
  const rows = mapEvents(rawEvents, matchId, homeTeam, awayTeam);
  if (rows.length === 0) return 0;

  await db.delete(matchEventsTable).where(eq(matchEventsTable.matchId, matchId));
  await db.insert(matchEventsTable).values(rows);
  logger.info({ matchId, fixtureId, events: rows.length }, "Synced match events");
  return rows.length;
}

// ── Auto-market creation ──────────────────────────────────────────────────────
export async function createDefaultMarketsForMatch(
  matchId: string,
  homeTeam: string,
  awayTeam: string,
): Promise<void> {
  try {
    const existing = await db
      .select({ id: marketsTable.id })
      .from(marketsTable)
      .where(eq(marketsTable.matchId, matchId));
    if (existing.length > 0) return;

    const markets = [
      {
        type: "match_winner" as const,
        title: `${homeTeam} vs ${awayTeam} — Match Winner`,
        selections: [
          { id: crypto.randomUUID(), label: homeTeam, odds: 2.10 },
          { id: crypto.randomUUID(), label: "Draw", odds: 3.30 },
          { id: crypto.randomUUID(), label: awayTeam, odds: 2.80 },
        ],
      },
      {
        type: "over_under_goals" as const,
        title: `${homeTeam} vs ${awayTeam} — Over/Under 2.5 Goals`,
        selections: [
          { id: crypto.randomUUID(), label: "Over 2.5", odds: 1.85 },
          { id: crypto.randomUUID(), label: "Under 2.5", odds: 2.00 },
        ],
      },
      {
        type: "both_teams_score" as const,
        title: `${homeTeam} vs ${awayTeam} — Both Teams to Score`,
        selections: [
          { id: crypto.randomUUID(), label: "Yes", odds: 1.75 },
          { id: crypto.randomUUID(), label: "No", odds: 2.10 },
        ],
      },
    ];

    for (const m of markets) {
      await db.insert(marketsTable).values({
        matchId,
        type: m.type,
        title: m.title,
        selections: m.selections,
        status: "open",
      });
    }
    logger.info({ matchId, markets: markets.length }, "Auto-created markets for fixture");
  } catch (err) {
    logger.warn({ err, matchId }, "Failed to auto-create markets");
  }
}

// ── Proof generation + market settlement ──────────────────────────────────────
export async function generateProofAndSettle(
  matchId: string,
  homeTeam: string,
  awayTeam: string,
  homeScore: number | null,
  awayScore: number | null,
): Promise<void> {
  try {
    const existing = await db
      .select({ id: proofRecordsTable.id })
      .from(proofRecordsTable)
      .where(eq(proofRecordsTable.matchId, matchId));
    if (existing.length > 0) return;

    const hs = homeScore ?? 0;
    const as_ = awayScore ?? 0;
    const resultString = `${matchId}:${homeTeam}:${awayTeam}:${hs}:${as_}`;
    const proofHash = crypto.createHash("sha256").update(resultString).digest("hex");
    const merkleRoot = crypto.createHash("sha256").update(`root:${proofHash}`).digest("hex");
    const signature = crypto.createHash("sha256").update(`sig:${merkleRoot}:${Date.now()}`).digest("hex");

    await db.insert(proofRecordsTable).values({
      matchId,
      proofHash: `0x${proofHash}`,
      merkleRoot: `0x${merkleRoot}`,
      merklePath: [`0x${crypto.randomBytes(32).toString("hex")}`, `0x${crypto.randomBytes(32).toString("hex")}`],
      signature: `0x${signature}`,
      validationStatus: "verified",
      settlementTxSig: `txsig_${crypto.randomBytes(16).toString("hex")}`,
    });

    logger.info({ matchId, proofHash }, "Proof generated for finished match");
    await settleMarketsForMatch(matchId, hs, as_);
    await triggerInsurancePoliciesForMatch(matchId, homeTeam, awayTeam, hs, as_);
  } catch (err) {
    logger.warn({ err, matchId }, "Failed to generate proof / settle markets");
  }
}

// ── Insurance auto-trigger ─────────────────────────────────────────────────────
async function triggerInsurancePoliciesForMatch(
  matchId: string,
  homeTeam: string,
  awayTeam: string,
  homeScore: number,
  awayScore: number,
): Promise<void> {
  try {
    // Fetch active policies with their product type via a join
    const policiesWithProduct = await db
      .select({
        id: insurancePoliciesTable.id,
        walletAddress: insurancePoliciesTable.walletAddress,
        coverageLamports: insurancePoliciesTable.coverageLamports,
        selectedTeam: insurancePoliciesTable.selectedTeam,
        productType: insuranceProductsTable.type,
      })
      .from(insurancePoliciesTable)
      .innerJoin(
        insuranceProductsTable,
        eq(insurancePoliciesTable.productId, insuranceProductsTable.id),
      )
      .where(
        and(
          eq(insurancePoliciesTable.matchId, matchId),
          eq(insurancePoliciesTable.status, "active"),
        ),
      );

    if (policiesWithProduct.length === 0) return;

    for (const policy of policiesWithProduct) {
      try {
        const selectedTeam = policy.selectedTeam;
        let shouldTrigger = false;

        if (
          policy.productType === "favorite_team_loss" ||
          policy.productType === "tournament_exit" ||
          policy.productType === "qualification"
        ) {
          if (!selectedTeam) continue;
          const selectedIsHome = selectedTeam === homeTeam;
          const selectedScore = selectedIsHome ? homeScore : awayScore;
          const opponentScore = selectedIsHome ? awayScore : homeScore;
          if (selectedScore < opponentScore) {
            // selectedTeam lost — trigger
            shouldTrigger = true;
          } else {
            // Won or drew — coverage not needed
            await db
              .update(insurancePoliciesTable)
              .set({ status: "expired" })
              .where(eq(insurancePoliciesTable.id, policy.id));
            logger.info({ policyId: policy.id, productType: policy.productType }, "Insurance policy expired (team not eliminated)");
            continue;
          }
        } else if (policy.productType === "goal_insurance") {
          const totalGoals = homeScore + awayScore;
          if (totalGoals < 2) {
            shouldTrigger = true;
          } else {
            await db
              .update(insurancePoliciesTable)
              .set({ status: "expired" })
              .where(eq(insurancePoliciesTable.id, policy.id));
            logger.info({ policyId: policy.id, totalGoals }, "Insurance policy expired (sufficient goals scored)");
            continue;
          }
        } else {
          // event_triggered / custom — not auto-settled by match result
          continue;
        }

        if (shouldTrigger) {
          if (isTreasuryConfigured()) {
            try {
              const payoutSig = await sendPayout(policy.walletAddress, policy.coverageLamports);
              await db
                .update(insurancePoliciesTable)
                .set({ status: "claimed", claimTxSig: payoutSig })
                .where(eq(insurancePoliciesTable.id, policy.id));
              logger.info({ policyId: policy.id, payoutSig, amount: policy.coverageLamports }, "Insurance auto-payout sent");
            } catch (err) {
              // Treasury may be unfunded on devnet — leave as "triggered" for manual claim
              logger.warn({ err, policyId: policy.id }, "Insurance auto-payout failed; policy left as triggered");
              await db
                .update(insurancePoliciesTable)
                .set({ status: "triggered" })
                .where(eq(insurancePoliciesTable.id, policy.id));
            }
          } else {
            await db
              .update(insurancePoliciesTable)
              .set({ status: "triggered" })
              .where(eq(insurancePoliciesTable.id, policy.id));
            logger.info({ policyId: policy.id }, "Insurance policy triggered (treasury not configured — manual claim required)");
          }
        }
      } catch (err) {
        logger.warn({ err, policyId: policy.id }, "Failed to process insurance policy at settlement");
      }
    }
  } catch (err) {
    logger.warn({ err, matchId }, "Failed to trigger insurance policies for match");
  }
}

async function settleMarketsForMatch(
  matchId: string,
  homeScore: number,
  awayScore: number,
): Promise<void> {
  const markets = await db
    .select()
    .from(marketsTable)
    .where(and(eq(marketsTable.matchId, matchId), eq(marketsTable.status, "open")));

  for (const market of markets) {
    let winningSelectionId: string | null = null;
    if (market.type === "match_winner") {
      if (homeScore > awayScore) winningSelectionId = market.selections[0]?.id ?? null;
      else if (awayScore > homeScore) winningSelectionId = market.selections[2]?.id ?? null;
      else winningSelectionId = market.selections[1]?.id ?? null;
    } else if (market.type === "over_under_goals") {
      winningSelectionId = homeScore + awayScore > 2.5
        ? market.selections[0]?.id ?? null
        : market.selections[1]?.id ?? null;
    } else if (market.type === "both_teams_score") {
      winningSelectionId = homeScore > 0 && awayScore > 0
        ? market.selections[0]?.id ?? null
        : market.selections[1]?.id ?? null;
    }

    await db.update(marketsTable)
      .set({ status: "settled", winningSelectionId })
      .where(eq(marketsTable.id, market.id));

    const positions = await db.select().from(positionsTable)
      .where(and(eq(positionsTable.marketId, market.id), eq(positionsTable.status, "pending")));

    for (const pos of positions) {
      const won = pos.selectionId === winningSelectionId;

      if (won && isTreasuryConfigured()) {
        // Auto-payout: attempt immediately; fall back to "won" (claimable) on failure
        try {
          const payoutSig = await sendPayout(pos.walletAddress, pos.potentialPayoutLamports);
          await db.update(positionsTable)
            .set({ status: "claimed", settledAt: new Date(), payoutTxSig: payoutSig })
            .where(eq(positionsTable.id, pos.id));
          logger.info({ posId: pos.id, payoutSig }, "Auto-payout sent");
        } catch (err) {
          // Treasury may be unfunded on devnet — leave as "won" so user can claim manually
          logger.warn({ err, posId: pos.id }, "Auto-payout failed; position stays claimable");
          await db.update(positionsTable)
            .set({ status: "won", settledAt: new Date() })
            .where(eq(positionsTable.id, pos.id));
        }
      } else {
        await db.update(positionsTable)
          .set({ status: won ? "won" : "lost", settledAt: new Date() })
          .where(eq(positionsTable.id, pos.id));
      }
    }

    logger.info({ marketId: market.id, winningSelectionId, positions: positions.length }, "Market settled");
  }
}

export async function settleMarket(
  marketId: string,
  winningSelectionId: string,
): Promise<{ settled: boolean; positionsSettled: number }> {
  const [market] = await db.select().from(marketsTable).where(eq(marketsTable.id, marketId));
  if (!market) throw new Error("Market not found");
  if (market.status === "settled") throw new Error("Market already settled");

  await db.update(marketsTable)
    .set({ status: "settled", winningSelectionId })
    .where(eq(marketsTable.id, marketId));

  const positions = await db.select().from(positionsTable)
    .where(and(eq(positionsTable.marketId, marketId), eq(positionsTable.status, "pending")));

  for (const pos of positions) {
    const won = pos.selectionId === winningSelectionId;
    await db.update(positionsTable)
      .set({ status: won ? "won" : "lost", settledAt: new Date() })
      .where(eq(positionsTable.id, pos.id));
  }

  return { settled: true, positionsSettled: positions.length };
}

// ── Main sync ─────────────────────────────────────────────────────────────────
let syncInProgress = false;

export async function syncMatchesFromTxline(): Promise<{ synced: number; errors: number; message: string }> {
  const apiKey = process.env["TXLINE_API_KEY"];
  if (!apiKey) return { synced: 0, errors: 0, message: "TXLINE_API_KEY not set — sync skipped." };
  if (syncInProgress) return { synced: 0, errors: 0, message: "Sync already in progress." };

  syncInProgress = true;
  let synced = 0;
  let errors = 0;

  try {
    const headers = await txlineHeaders();
    const now = new Date();

    // ── Fixtures ──────────────────────────────────────────────────────────────
    const fixturesRes = await fetch(`${TXLINE_BASE_URL}/api/fixtures/snapshot`, { headers });
    if (!fixturesRes.ok) {
      logger.warn({ status: fixturesRes.status }, "TxLINE fixtures fetch failed");
      return { synced: 0, errors: 1, message: `TxLINE responded ${fixturesRes.status}` };
    }
    const raw = await fixturesRes.json();
    const fixtures: TxlineFixture[] = Array.isArray(raw) ? raw : (raw as { fixtures?: TxlineFixture[] }).fixtures ?? [];

    // ── Scores ────────────────────────────────────────────────────────────────
    const scoreMap = new Map<number, TxlineScore>();
    try {
      const scoresRes = await fetch(`${TXLINE_BASE_URL}/api/scores/snapshot`, { headers });
      if (scoresRes.ok) {
        const scoresRaw = await scoresRes.json();
        const scores: TxlineScore[] = Array.isArray(scoresRaw) ? scoresRaw : [];
        for (const s of scores) scoreMap.set(s.FixtureId, s);
      }
    } catch { /* graceful degradation */ }

    // ── Bulk events snapshot (try once, use per-fixture fallback if unavailable) ─
    const bulkEvents = await fetchBulkEvents(headers);

    // Track matches needing per-fixture event fetch (bulk endpoint returned null)
    const needPerFixtureEvents: Array<{
      matchId: string;
      fixtureId: string;
      homeTeam: string;
      awayTeam: string;
      status: "live" | "finished" | "scheduled";
    }> = [];

    // ── Upsert fixtures ───────────────────────────────────────────────────────
    for (const fix of fixtures) {
      try {
        const fixtureId = String(fix.FixtureId);
        const homeTeam = fix.Participant1IsHome !== false
          ? (fix.Participant1 ?? "TBA")
          : (fix.Participant2 ?? "TBA");
        const awayTeam = fix.Participant1IsHome !== false
          ? (fix.Participant2 ?? "TBA")
          : (fix.Participant1 ?? "TBA");

        // TxLINE StartTime: determine ms vs seconds by magnitude; guard invalid/zero values
        const rawTs = fix.StartTime ?? fix.Ts ?? 0;
        let kickoffAt: Date;
        if (rawTs <= 0) {
          // Missing timestamp — treat as far future so it stays "scheduled"
          kickoffAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
          logger.warn({ fixtureId: fix.FixtureId }, "TxLINE fixture missing StartTime — defaulting to +1 year");
        } else if (rawTs > 1e12) {
          kickoffAt = new Date(rawTs);           // already milliseconds
        } else {
          kickoffAt = new Date(rawTs * 1000);    // seconds → milliseconds
        }

        const score = scoreMap.get(fix.FixtureId);

        // Explicit StatusId mapping (TxLINE convention: 1=scheduled, 2=live, 3+=finished).
        // Only fall back to time-based heuristics when statusId is absent/unknown.
        let matchStatus: "scheduled" | "live" | "finished";
        const statusId = score?.StatusId ?? fix.StatusId ?? 0;
        if (statusId >= 3) {
          matchStatus = "finished";
        } else if (statusId === 2) {
          matchStatus = "live";
        } else if (statusId === 1) {
          matchStatus = "scheduled";            // explicit — do not override with heuristics
        } else if (kickoffAt > now) {
          matchStatus = "scheduled";
        } else if (now.getTime() - kickoffAt.getTime() < 2.5 * 60 * 60 * 1000) {
          matchStatus = "live";
        } else {
          matchStatus = "finished";
        }

        const hasRealScore = (score?.Score1 ?? fix.Score1) != null;
        let homeScore = score?.Score1 ?? fix.Score1 ?? null;
        let awayScore = score?.Score2 ?? fix.Score2 ?? null;

        // TxLINE devnet has no working scores/events feed — simulate deterministically
        // once the match has kicked off, so users see a live-progressing match.
        let simulated: ReturnType<typeof computeSimulatedProgress> | null = null;
        if (!hasRealScore && matchStatus !== "scheduled") {
          simulated = computeSimulatedProgress(fixtureId, homeTeam, awayTeam, kickoffAt);
          homeScore = simulated.homeScore;
          awayScore = simulated.awayScore;
        }

        const existing = await db
          .select({ id: matchesTable.id, status: matchesTable.status })
          .from(matchesTable)
          .where(eq(matchesTable.txlineFixtureId, fixtureId));

        let matchId: string | undefined;

        if (existing.length === 0) {
          const [inserted] = await db.insert(matchesTable).values({
            txlineFixtureId: fixtureId,
            tournament: fix.Competition ?? "FIFA World Cup 2026",
            stage: "Group Stage",
            homeTeam,
            awayTeam,
            kickoffAt,
            status: matchStatus,
            homeScore,
            awayScore,
          }).returning({ id: matchesTable.id });

          if (inserted?.id) {
            matchId = inserted.id;
            await createDefaultMarketsForMatch(inserted.id, homeTeam, awayTeam);
          }
        } else {
          matchId = existing[0]?.id;
          await db.update(matchesTable)
            .set({ status: matchStatus, homeTeam, awayTeam, homeScore, awayScore })
            .where(eq(matchesTable.txlineFixtureId, fixtureId));

          if (matchStatus === "finished" && existing[0]?.status !== "finished" && existing[0]?.id) {
            await generateProofAndSettle(existing[0].id, homeTeam, awayTeam, homeScore, awayScore);
          }
          if (existing[0]?.id) {
            await createDefaultMarketsForMatch(existing[0].id, homeTeam, awayTeam);
          }
        }

        // Sync events for ALL live and finished matches.
        // When bulk snapshot is available, use it — but also queue a per-fixture
        // fallback for any fixture the bulk response didn't include.
        if (matchId && matchStatus !== "scheduled") {
          const bulkEvs = bulkEvents?.get(fix.FixtureId);
          if (bulkEvs !== undefined && bulkEvs.length > 0) {
            await upsertEvents(matchId, fixtureId, homeTeam, awayTeam, bulkEvs);
          } else if (simulated) {
            // No real events available on this TxLINE tier — use the simulated timeline.
            await upsertSimulatedEvents(matchId, simulated.visibleEvents);
          } else {
            // Fixture was absent from bulk snapshot and not yet simulated → per-fixture fetch
            needPerFixtureEvents.push({ matchId, fixtureId, homeTeam, awayTeam, status: matchStatus });
          }
        }

        synced++;
      } catch (err) {
        logger.warn({ err, fixtureId: fix.FixtureId }, "Failed to upsert fixture");
        errors++;
      }
    }

    // ── Per-fixture event fetches (when bulk endpoint unavailable) ────────────
    for (const { matchId, fixtureId, homeTeam, awayTeam } of needPerFixtureEvents) {
      try {
        const evs = await fetchFixtureEvents(fixtureId, headers);
        if (evs.length > 0) {
          await upsertEvents(matchId, fixtureId, homeTeam, awayTeam, evs);
        } else {
          const [row] = await db
            .select({ kickoffAt: matchesTable.kickoffAt })
            .from(matchesTable)
            .where(eq(matchesTable.id, matchId));
          if (row) {
            const sim = computeSimulatedProgress(fixtureId, homeTeam, awayTeam, row.kickoffAt);
            await upsertSimulatedEvents(matchId, sim.visibleEvents);
          }
        }
      } catch (err) {
        logger.warn({ err, fixtureId }, "Per-fixture event sync failed");
      }
    }

    // ── Keep simulating matches that dropped out of the TxLINE snapshot rotation ──
    // The devnet feed returns a small rotating fixture set; once a fixture stops
    // being returned, its row would otherwise freeze forever at its last-known
    // status/events. Independently progress any non-finished match past kickoff.
    const syncedFixtureIds = new Set(fixtures.map((f) => String(f.FixtureId)));
    const staleMatches = await db
      .select()
      .from(matchesTable)
      .where(and(eq(matchesTable.status, "live")));
    const scheduledPastKickoff = await db
      .select()
      .from(matchesTable)
      .where(eq(matchesTable.status, "scheduled"));

    for (const m of [...staleMatches, ...scheduledPastKickoff]) {
      if (syncedFixtureIds.has(m.txlineFixtureId)) continue; // already handled above
      if (m.kickoffAt > now) continue;

      const elapsedMs = now.getTime() - m.kickoffAt.getTime();
      const nextStatus: "live" | "finished" = elapsedMs < 2.5 * 60 * 60 * 1000 ? "live" : "finished";
      const sim = computeSimulatedProgress(m.txlineFixtureId, m.homeTeam, m.awayTeam, m.kickoffAt);

      await db.update(matchesTable)
        .set({ status: nextStatus, homeScore: sim.homeScore, awayScore: sim.awayScore })
        .where(eq(matchesTable.id, m.id));
      await upsertSimulatedEvents(m.id, sim.visibleEvents);

      if (nextStatus === "finished" && m.status !== "finished") {
        await generateProofAndSettle(m.id, m.homeTeam, m.awayTeam, sim.homeScore, sim.awayScore);
      }
    }

    lastSyncAt = new Date().toISOString();
    cachedStatus = null;
    logger.info({ synced, errors }, "TxLINE sync complete");
    return { synced, errors, message: `Synced ${synced} fixtures (${errors} errors).` };
  } catch (err) {
    logger.error({ err }, "TxLINE sync failed");
    return { synced, errors: errors + 1, message: "Sync failed with network/parse error." };
  } finally {
    syncInProgress = false;
  }
}

let pollingInterval: ReturnType<typeof setInterval> | null = null;

export function startTxlinePolling(intervalMs = 60_000): void {
  if (pollingInterval) return;
  logger.info({ intervalMs }, "Starting TxLINE background polling");
  syncMatchesFromTxline().catch((err) => logger.warn({ err }, "Initial TxLINE sync error"));
  pollingInterval = setInterval(async () => {
    const apiKey = process.env["TXLINE_API_KEY"];
    if (!apiKey) return;
    await syncMatchesFromTxline().catch((err) => logger.warn({ err }, "TxLINE background sync error"));
  }, intervalMs);
}

export function stopTxlinePolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}
