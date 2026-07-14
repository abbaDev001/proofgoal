import { pgTable, text, uuid, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { matchesTable } from "./matches";

export const insuranceTypeValues = [
  "favorite_team_loss",
  "tournament_exit",
  "qualification",
  "goal_insurance",
  "event_triggered",
  "custom",
] as const;

export const policyStatusValues = [
  "active",
  "triggered",
  "expired",
  "claimed",
  "void",
] as const;

export const insuranceProductsTable = pgTable("insurance_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: text("type", { enum: insuranceTypeValues }).notNull(),
  description: text("description").notNull(),
  premiumRateBps: integer("premium_rate_bps").notNull(),
  maxCoverageLamports: numeric("max_coverage_lamports", {
    precision: 20,
    scale: 0,
    mode: "number",
  }).notNull(),
  triggerCondition: text("trigger_condition").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertInsuranceProductSchema = createInsertSchema(
  insuranceProductsTable,
).omit({ id: true, createdAt: true });
export type InsertInsuranceProduct = z.infer<
  typeof insertInsuranceProductSchema
>;
export type InsuranceProduct = typeof insuranceProductsTable.$inferSelect;

export const insurancePoliciesTable = pgTable("insurance_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletAddress: text("wallet_address").notNull(),
  productId: uuid("product_id")
    .notNull()
    .references(() => insuranceProductsTable.id, { onDelete: "cascade" }),
  matchId: uuid("match_id").references(() => matchesTable.id, {
    onDelete: "set null",
  }),
  selectedTeam: text("selected_team"),
  premiumPaidLamports: numeric("premium_paid_lamports", {
    precision: 20,
    scale: 0,
    mode: "number",
  }).notNull(),
  coverageLamports: numeric("coverage_lamports", {
    precision: 20,
    scale: 0,
    mode: "number",
  }).notNull(),
  status: text("status", { enum: policyStatusValues })
    .notNull()
    .default("active"),
  purchasedAt: timestamp("purchased_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  claimTxSig: text("claim_tx_sig"),
  premiumTxSig: text("premium_tx_sig"),
});

export const insertInsurancePolicySchema = createInsertSchema(
  insurancePoliciesTable,
).omit({ id: true, purchasedAt: true });
export type InsertInsurancePolicy = z.infer<
  typeof insertInsurancePolicySchema
>;
export type InsurancePolicy = typeof insurancePoliciesTable.$inferSelect;
