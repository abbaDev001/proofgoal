import { Router, type IRouter } from "express";
import { asc, count, eq } from "drizzle-orm";
import { db, marketsTable, matchesTable, matchEventsTable } from "@workspace/db";
import {
  ListMatchesQueryParams,
  ListMatchesResponse,
  ListLiveMatchesResponse,
  GetMatchParams,
  GetMatchResponse,
  ListMatchEventsParams,
  ListMatchEventsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/matches", async (req, res): Promise<void> => {
  const parsed = ListMatchesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const matches = await db
    .select()
    .from(matchesTable)
    .where(
      parsed.data.status ? eq(matchesTable.status, parsed.data.status) : undefined,
    )
    .orderBy(matchesTable.kickoffAt);

  res.json(ListMatchesResponse.parse(matches));
});

router.get("/matches/live", async (_req, res): Promise<void> => {
  const matches = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.status, "live"))
    .orderBy(matchesTable.kickoffAt);

  res.json(ListLiveMatchesResponse.parse(matches));
});

router.get("/matches/:matchId", async (req, res): Promise<void> => {
  const params = GetMatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [match] = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.id, params.data.matchId));

  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  const [marketCountRow] = await db
    .select({ value: count() })
    .from(marketsTable)
    .where(eq(marketsTable.matchId, match.id));

  res.json(
    GetMatchResponse.parse({
      ...match,
      marketCount: marketCountRow?.value ?? 0,
      proofStatus: null,
    }),
  );
});

router.get("/matches/:matchId/events", async (req, res): Promise<void> => {
  const params = ListMatchEventsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const events = await db
    .select()
    .from(matchEventsTable)
    .where(eq(matchEventsTable.matchId, params.data.matchId))
    .orderBy(asc(matchEventsTable.minute));

  res.json(ListMatchEventsResponse.parse(events));
});

export default router;
