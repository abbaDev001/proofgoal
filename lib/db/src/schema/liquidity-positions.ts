import { pgTable, text, uuid, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { liquidityPoolsTable } from "./liquidity";

export const liquidityPositionsTable = pgTable("liquidity_positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  poolId: uuid("pool_id")
    .notNull()
    .references(() => liquidityPoolsTable.id, { onDelete: "cascade" }),
  walletAddress: text("wallet_address").notNull(),
  depositedLamports: numeric("deposited_lamports", {
    precision: 20,
    scale: 0,
    mode: "number",
  })
    .notNull()
    .default(0),
  depositedAt: timestamp("deposited_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastAccrualAt: timestamp("last_accrual_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  accruedYieldLamports: numeric("accrued_yield_lamports", {
    precision: 20,
    scale: 0,
    mode: "number",
  })
    .notNull()
    .default(0),
  lastDepositTxSig: text("last_deposit_tx_sig"),
});

export const insertLiquidityPositionSchema = createInsertSchema(
  liquidityPositionsTable,
).omit({ id: true, depositedAt: true, lastAccrualAt: true });
export type InsertLiquidityPosition = z.infer<
  typeof insertLiquidityPositionSchema
>;
export type LiquidityPosition = typeof liquidityPositionsTable.$inferSelect;
