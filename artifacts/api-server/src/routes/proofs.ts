import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, proofRecordsTable } from "@workspace/db";
import {
  ListProofRecordsQueryParams,
  ListProofRecordsResponse,
  GetProofRecordParams,
  GetProofRecordResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/proofs", async (req, res): Promise<void> => {
  const parsed = ListProofRecordsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const conditions = [];
  if (parsed.data.matchId) {
    conditions.push(eq(proofRecordsTable.matchId, parsed.data.matchId));
  }
  if (parsed.data.status) {
    conditions.push(
      eq(proofRecordsTable.validationStatus, parsed.data.status),
    );
  }

  const proofs = await db
    .select()
    .from(proofRecordsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(proofRecordsTable.createdAt));

  res.json(ListProofRecordsResponse.parse(proofs));
});

router.get("/proofs/:proofId", async (req, res): Promise<void> => {
  const params = GetProofRecordParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [proof] = await db
    .select()
    .from(proofRecordsTable)
    .where(eq(proofRecordsTable.id, params.data.proofId));

  if (!proof) {
    res.status(404).json({ error: "Proof record not found" });
    return;
  }

  res.json(GetProofRecordResponse.parse(proof));
});

export default router;
