import { pgTable, text, uuid, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { marketTypeValues } from "./markets";

export const liquidityPoolsTable = pgTable("liquidity_pools", {
  id: uuid("id").primaryKey().defaultRandom(),
  marketType: text("market_type", { enum: marketTypeValues }).notNull(),
  totalLiquidityLamports: numeric("total_liquidity_lamports", {
    precision: 20,
    scale: 0,
    mode: "number",
  })
    .notNull()
    .default(0),
  aprBps: integer("apr_bps").notNull().default(0),
  providerCount: integer("provider_count").notNull().default(0),
});

export const insertLiquidityPoolSchema = createInsertSchema(
  liquidityPoolsTable,
).omit({ id: true });
export type InsertLiquidityPool = z.infer<typeof insertLiquidityPoolSchema>;
export type LiquidityPool = typeof liquidityPoolsTable.$inferSelect;
