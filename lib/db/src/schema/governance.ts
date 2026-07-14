import { pgTable, text, uuid, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const proposalStatusValues = [
  "active",
  "passed",
  "rejected",
  "expired",
] as const;

export const voteChoiceValues = ["for", "against"] as const;

export const governanceProposalsTable = pgTable("governance_proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status", { enum: proposalStatusValues })
    .notNull()
    .default("active"),
  votesFor: numeric("votes_for", { precision: 20, scale: 9, mode: "number" })
    .notNull()
    .default(0),
  votesAgainst: numeric("votes_against", {
    precision: 20,
    scale: 9,
    mode: "number",
  })
    .notNull()
    .default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
});

export const insertGovernanceProposalSchema = createInsertSchema(
  governanceProposalsTable,
).omit({ id: true, createdAt: true, votesFor: true, votesAgainst: true });
export type InsertGovernanceProposal = z.infer<
  typeof insertGovernanceProposalSchema
>;
export type GovernanceProposal = typeof governanceProposalsTable.$inferSelect;

export const votesTable = pgTable("votes", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposal_id")
    .notNull()
    .references(() => governanceProposalsTable.id, { onDelete: "cascade" }),
  walletAddress: text("wallet_address").notNull(),
  choice: text("choice", { enum: voteChoiceValues }).notNull(),
  weight: numeric("weight", { precision: 20, scale: 9, mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertVoteSchema = createInsertSchema(votesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertVote = z.infer<typeof insertVoteSchema>;
export type Vote = typeof votesTable.$inferSelect;
