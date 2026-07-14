import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, marketsTable } from "@workspace/db";
import {
  ListMarketsQueryParams,
  ListMarketsResponse,
  CreateCustomMarketBody,
  CreateCustomMarketResponse,
  GetMarketParams,
  GetMarketResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/markets", async (req, res): Promise<void> => {
  const parsed = ListMarketsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const conditions = [];
  if (parsed.data.matchId) {
    conditions.push(eq(marketsTable.matchId, parsed.data.matchId));
  }
  if (parsed.data.type) {
    conditions.push(eq(marketsTable.type, parsed.data.type));
  }
  if (parsed.data.status) {
    conditions.push(eq(marketsTable.status, parsed.data.status));
  }

  const markets = await db
    .select()
    .from(marketsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(marketsTable.createdAt);

  res.json(ListMarketsResponse.parse(markets));
});

router.post("/markets", async (req, res): Promise<void> => {
  const parsed = CreateCustomMarketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const selectionsWithIds = parsed.data.selections.map((selection) => ({
    id: crypto.randomUUID(),
    label: selection.label,
    odds: selection.odds,
  }));

  const [created] = await db
    .insert(marketsTable)
    .values({
      matchId: parsed.data.matchId ?? null,
      type: parsed.data.type,
      title: parsed.data.title,
      selections: selectionsWithIds,
    })
    .returning();

  res.status(201).json(CreateCustomMarketResponse.parse(created));
});

router.get("/markets/:marketId", async (req, res): Promise<void> => {
  const params = GetMarketParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [market] = await db
    .select()
    .from(marketsTable)
    .where(eq(marketsTable.id, params.data.marketId));

  if (!market) {
    res.status(404).json({ error: "Market not found" });
    return;
  }

  res.json(GetMarketResponse.parse(market));
});

export default router;
