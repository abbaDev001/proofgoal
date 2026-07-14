import { pgTable, text, uuid, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const matchStatusValues = [
  "scheduled",
  "live",
  "finished",
  "postponed",
] as const;

export const matchesTable = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  txlineFixtureId: text("txline_fixture_id").notNull().unique(),
  tournament: text("tournament").notNull(),
  stage: text("stage").notNull(),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  kickoffAt: timestamp("kickoff_at", { withTimezone: true }).notNull(),
  status: text("status", { enum: matchStatusValues })
    .notNull()
    .default("scheduled"),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertMatchSchema = createInsertSchema(matchesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matchesTable.$inferSelect;

export const matchEventsTable = pgTable("match_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id")
    .notNull()
    .references(() => matchesTable.id, { onDelete: "cascade" }),
  minute: integer("minute").notNull(),
  type: text("type").notNull(),
  team: text("team"),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertMatchEventSchema = createInsertSchema(
  matchEventsTable,
).omit({ id: true, createdAt: true });
export type InsertMatchEvent = z.infer<typeof insertMatchEventSchema>;
export type MatchEvent = typeof matchEventsTable.$inferSelect;
