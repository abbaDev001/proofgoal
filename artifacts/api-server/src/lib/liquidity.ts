/**
 * Liquidity yield accrual helper.
 *
 * Computes elapsed time since lastAccrualAt and adds accrued yield to the position.
 * Called lazily on deposit, withdraw, and GET — no background job needed.
 */
import { eq } from "drizzle-orm";
import { db, liquidityPositionsTable, liquidityPoolsTable } from "@workspace/db";
import type { LiquidityPosition, LiquidityPool } from "@workspace/db";

/**
 * Accrues yield for a position given its pool's aprBps.
 * Updates the DB row in-place and returns the updated position.
 */
export async function accrueYield(
  position: LiquidityPosition,
  pool: LiquidityPool,
): Promise<LiquidityPosition> {
  const now = new Date();
  const lastAccrual = new Date(position.lastAccrualAt);
  const elapsedMs = now.getTime() - lastAccrual.getTime();

  if (elapsedMs <= 0 || pool.aprBps <= 0 || position.depositedLamports <= 0) {
    return position;
  }

  const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
  const newYield = Math.floor(
    position.depositedLamports * (pool.aprBps / 10_000) * (elapsedMs / YEAR_MS),
  );

  if (newYield <= 0) return position;

  const [updated] = await db
    .update(liquidityPositionsTable)
    .set({
      accruedYieldLamports: position.accruedYieldLamports + newYield,
      lastAccrualAt: now,
    })
    .where(eq(liquidityPositionsTable.id, position.id))
    .returning();

  return updated ?? position;
}
