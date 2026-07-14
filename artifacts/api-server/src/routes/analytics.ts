import { Router, type IRouter } from "express";
import { count, eq, sql } from "drizzle-orm";
import {
  db,
  insurancePoliciesTable,
  marketsTable,
  positionsTable,
  usersTable,
} from "@workspace/db";
import {
  GetAnalyticsSummaryResponse,
  GetVolumeSeriesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/analytics/summary", async (_req, res): Promise<void> => {
  const [[volumeRow], [openInterestRow], [activeMarketsRow], [activePoliciesRow], [totalUsersRow], [settledMarketsRow]] =
    await Promise.all([
      db
        .select({ value: sql<string>`coalesce(sum(${positionsTable.stakeLamports}), 0)` })
        .from(positionsTable),
      db
        .select({ value: sql<string>`coalesce(sum(${positionsTable.stakeLamports}), 0)` })
        .from(positionsTable)
        .where(eq(positionsTable.status, "pending")),
      db
        .select({ value: count() })
        .from(marketsTable)
        .where(eq(marketsTable.status, "open")),
      db
        .select({ value: count() })
        .from(insurancePoliciesTable)
        .where(eq(insurancePoliciesTable.status, "active")),
      db.select({ value: count() }).from(usersTable),
      db
        .select({ value: count() })
        .from(marketsTable)
        .where(eq(marketsTable.status, "settled")),
    ]);

  res.json(
    GetAnalyticsSummaryResponse.parse({
      totalVolumeLamports: Number(volumeRow?.value ?? 0),
      openInterestLamports: Number(openInterestRow?.value ?? 0),
      activeMarkets: activeMarketsRow?.value ?? 0,
      activePolicies: activePoliciesRow?.value ?? 0,
      totalUsers: totalUsersRow?.value ?? 0,
      settledMarkets: settledMarketsRow?.value ?? 0,
    }),
  );
});

router.get("/analytics/volume-series", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      date: sql<string>`date_trunc('day', ${positionsTable.placedAt})`,
      volumeLamports: sql<string>`coalesce(sum(${positionsTable.stakeLamports}), 0)`,
    })
    .from(positionsTable)
    .groupBy(sql`date_trunc('day', ${positionsTable.placedAt})`)
    .orderBy(sql`date_trunc('day', ${positionsTable.placedAt})`);

  const series = rows.map((row) => ({
    date: row.date,
    volumeLamports: Number(row.volumeLamports),
  }));

  res.json(GetVolumeSeriesResponse.parse(series));
});

export default router;
