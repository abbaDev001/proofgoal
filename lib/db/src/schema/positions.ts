import { pgTable, text, uuid, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { marketsTable } from "./markets";

export const positionStatusValues = [
  "pending",
  "won",
  "lost",
  "void",
  "claimed",
] as const;

export const positionsTable = pgTable("positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletAddress: text("wallet_address").notNull(),
  marketId: uuid("market_id")
    .notNull()
    .references(() => marketsTable.id, { onDelete: "cascade" }),
  selectionId: text("selection_id").notNull(),
  stakeLamports: numeric("stake_lamports", {
    precision: 20,
    scale: 0,
    mode: "number",
  }).notNull(),
  potentialPayoutLamports: numeric("potential_payout_lamports", {
    precision: 20,
    scale: 0,
    mode: "number",
  }).notNull(),
  status: text("status", { enum: positionStatusValues })
    .notNull()
    .default("pending"),
  placedAt: timestamp("placed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  settledAt: timestamp("settled_at", { withTimezone: true }),
  settlementTxSig: text("settlement_tx_sig"),
  payoutTxSig: text("payout_tx_sig"),
});

export const insertPositionSchema = createInsertSchema(positionsTable).omit({
  id: true,
  placedAt: true,
});
export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type Position = typeof positionsTable.$inferSelect;
