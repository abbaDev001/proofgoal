import {
  pgTable,
  text,
  uuid,
  timestamp,
  numeric,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { matchesTable } from "./matches";

export const marketTypeValues = [
  "match_winner",
  "draw",
  "double_chance",
  "exact_score",
  "first_scorer",
  "anytime_scorer",
  "over_under_goals",
  "corners",
  "cards",
  "both_teams_score",
  "tournament_winner",
  "group_winner",
  "custom",
] as const;

export const marketStatusValues = [
  "open",
  "suspended",
  "settled",
  "void",
] as const;

export interface MarketSelectionRecord {
  id: string;
  label: string;
  odds: number;
}

export const marketsTable = pgTable("markets", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id").references(() => matchesTable.id, {
    onDelete: "set null",
  }),
  type: text("type", { enum: marketTypeValues }).notNull(),
  title: text("title").notNull(),
  status: text("status", { enum: marketStatusValues })
    .notNull()
    .default("open"),
  selections: jsonb("selections").$type<MarketSelectionRecord[]>().notNull(),
  winningSelectionId: text("winning_selection_id"),
  liquidityLamports: numeric("liquidity_lamports", {
    precision: 20,
    scale: 0,
    mode: "number",
  })
    .notNull()
    .default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertMarketSchema = createInsertSchema(marketsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMarket = z.infer<typeof insertMarketSchema>;
export type Market = typeof marketsTable.$inferSelect;
