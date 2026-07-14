import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { matchesTable } from "./matches";

export const validationStatusValues = ["pending", "verified", "failed"] as const;

export const proofRecordsTable = pgTable("proof_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id")
    .notNull()
    .references(() => matchesTable.id, { onDelete: "cascade" }),
  merkleRoot: text("merkle_root").notNull(),
  merklePath: text("merkle_path").array().notNull(),
  proofHash: text("proof_hash").notNull(),
  signature: text("signature").notNull(),
  validationStatus: text("validation_status", {
    enum: validationStatusValues,
  })
    .notNull()
    .default("pending"),
  settlementTxSig: text("settlement_tx_sig"),
  verificationReceiptUrl: text("verification_receipt_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertProofRecordSchema = createInsertSchema(
  proofRecordsTable,
).omit({ id: true, createdAt: true });
export type InsertProofRecord = z.infer<typeof insertProofRecordSchema>;
export type ProofRecord = typeof proofRecordsTable.$inferSelect;
