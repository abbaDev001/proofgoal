import { useEffect } from "react";
import { useParams, Link } from "wouter";
import {
  useGetMatch,
  useListMatchEvents,
  useListMarkets,
  getGetMatchQueryKey,
  getListMatchEventsQueryKey,
  getListMarketsQueryKey,
  type MatchDetail,
  type MatchEvent,
  type Market,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

// ── Event metadata helpers ────────────────────────────────────────────────────

type EventMeta = {
  icon: string;
  label: string;
  color: string;
  bg: string;
};

function getEventMeta(type: string): EventMeta {
  const t = type.toLowerCase().replace(/[-\s]/g, "_");
  if (t.includes("goal") || t === "score") {
    if (t.includes("own"))
      return { icon: "⚽", label: "Own Goal",     color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/30" };
    if (t.includes("pen"))
      return { icon: "⚽", label: "Penalty Goal",  color: "text-green-600",  bg: "bg-green-50 dark:bg-green-950/30"  };
    return       { icon: "⚽", label: "Goal",         color: "text-green-600",  bg: "bg-green-50 dark:bg-green-950/30"  };
  }
  if (t.includes("yellow_red") || t.includes("double_yellow") || t.includes("second_yellow"))
    return { icon: "🟥", label: "2nd Yellow → Red",   color: "text-red-600",    bg: "bg-red-50 dark:bg-red-950/30"    };
  if (t.includes("red"))
    return { icon: "🟥", label: "Red Card",            color: "text-red-600",    bg: "bg-red-50 dark:bg-red-950/30"    };
  if (t.includes("yellow"))
    return { icon: "🟨", label: "Yellow Card",         color: "text-amber-600",  bg: "bg-amber-50 dark:bg-amber-950/30" };
  if (t.includes("sub"))
    return { icon: "↕",  label: "Substitution",        color: "text-blue-600",   bg: "bg-blue-50 dark:bg-blue-950/30"  };
  if (t.includes("var") || t.includes("video"))
    return { icon: "📺", label: "VAR Review",          color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/30" };
  if (t.includes("penalty_miss") || t.includes("pen_miss"))
    return { icon: "✖",  label: "Penalty Miss",        color: "text-red-400",    bg: "bg-red-50 dark:bg-red-950/30"    };
  if (t.includes("offside"))
    return { icon: "⛳", label: "Offside",             color: "text-muted-foreground", bg: "bg-secondary" };
  if (t.includes("foul") || t.includes("free"))
    return { icon: "⚡", label: "Foul",               color: "text-muted-foreground", bg: "bg-secondary" };
  if (t.includes("corner"))
    return { icon: "🔵", label: "Corner",             color: "text-blue-400",   bg: "bg-secondary" };
  if (t.includes("kick_off") || t.includes("kickoff") || t.includes("start"))
    return { icon: "▶",  label: "Kick Off",           color: "text-primary",    bg: "bg-primary/5"  };
  if (t.includes("half") || t.includes("break"))
    return { icon: "⏸",  label: "Half Time",          color: "text-primary",    bg: "bg-primary/5"  };
  if (t.includes("end") || t.includes("full") || t.includes("whistle"))
    return { icon: "⏹",  label: "Full Time",          color: "text-primary",    bg: "bg-primary/5"  };
  return { icon: "•", label: type.replace(/_/g, " "), color: "text-muted-foreground", bg: "bg-secondary" };
}

// ── Timeline ──────────────────────────────────────────────────────────────────

function Timeline({ events, matchStatus }: { events: MatchEvent[]; matchStatus: string }) {
  if (!events.length) {
    return (
      <div className="p-6 text-center border rounded bg-card text-sm text-muted-foreground space-y-1">
        {matchStatus === "scheduled" ? (
          <>
            <p className="text-2xl mb-2">⏳</p>
            <p className="font-medium">Match hasn&apos;t kicked off yet</p>
            <p className="text-xs">Events will appear here once the game starts.</p>
          </>
        ) : matchStatus === "live" ? (
          <>
            <p className="text-2xl mb-2 animate-pulse">⚽</p>
            <p className="font-medium">Waiting for first event…</p>
          </>
        ) : (
          <>
            <p className="text-2xl mb-2">📋</p>
            <p className="font-medium">No events recorded</p>
            <p className="text-xs">TxLINE did not provide event data for this match.</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {/* Vertical connector line */}
      <div className="absolute left-[28px] top-0 bottom-0 w-px bg-border" />

      {events.map((event, idx) => {
        const meta = getEventMeta(event.type);
        return (
          <div key={event.id} className={`relative flex gap-3 py-2 ${idx === 0 ? "pt-0" : ""}`}>
            {/* Minute bubble */}
            <div
              className={`shrink-0 w-14 h-7 rounded-full text-[11px] font-mono font-bold flex items-center justify-center z-10 border ${meta.color} ${meta.bg} border-current/20`}
            >
              {event.minute}&apos;
            </div>

            {/* Event body */}
            <div className={`flex-1 min-w-0 rounded-lg px-3 py-2 ${meta.bg} border border-current/10 ${meta.color}`}>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-base leading-none">{meta.icon}</span>
                <span className="font-bold text-xs uppercase tracking-wide">{meta.label}</span>
                {event.team && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-background/50 font-medium">
                    {event.team}
                  </span>
                )}
              </div>
              {event.description && (
                <p className="text-xs mt-0.5 opacity-80 leading-snug">{event.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Market card ───────────────────────────────────────────────────────────────

function MarketCard({ market }: { market: Market }) {
  return (
    <Card>
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between gap-2 bg-secondary/50 rounded-t-lg">
        <CardTitle className="text-sm leading-tight">{market.title}</CardTitle>
        <Link href={`/markets/${market.id}`}>
          <Button size="sm" variant="secondary" className="shrink-0 text-xs">Trade</Button>
        </Link>
      </CardHeader>
      <CardContent className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {market.selections.slice(0, 4).map((sel) => (
          <Link key={sel.id} href={`/markets/${market.id}`}>
            <div className="text-center p-2 border rounded hover:border-primary/50 transition-colors cursor-pointer">
              <div className="text-[10px] text-muted-foreground truncate">{sel.label}</div>
              <div className="font-mono font-bold text-sm mt-0.5 text-primary">{sel.odds.toFixed(2)}</div>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function MatchDetailPage() {
  const { matchId } = useParams();
  const queryClient = useQueryClient();

  // Fetch match — static options (no self-reference)
  const { data: match, isLoading: matchLoading } = useGetMatch(matchId!, {
    query: {
      enabled: !!matchId,
      queryKey: getGetMatchQueryKey(matchId!),
    },
  });

  // Fetch events — static options
  const { data: eventsRaw, isLoading: eventsLoading } = useListMatchEvents(matchId!, {
    query: {
      enabled: !!matchId,
      queryKey: getListMatchEventsQueryKey(matchId!),
    },
  });
  const events: MatchEvent[] = Array.isArray(eventsRaw) ? eventsRaw : [];

  // Fetch markets
  const { data: marketsRaw, isLoading: marketsLoading } = useListMarkets(
    { matchId },
    { query: { enabled: !!matchId, queryKey: getListMarketsQueryKey({ matchId }) } },
  );
  const markets: Market[] = Array.isArray(marketsRaw) ? marketsRaw : [];

  // Live polling — separate effect to avoid self-reference in hook options
  const matchStatus = (match as MatchDetail | undefined)?.status;
  useEffect(() => {
    if (matchStatus !== "live" || !matchId) return;
    const id = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: getGetMatchQueryKey(matchId) });
      void queryClient.invalidateQueries({ queryKey: getListMatchEventsQueryKey(matchId) });
    }, 30_000);
    return () => clearInterval(id);
  }, [matchStatus, matchId, queryClient]);

  const handleRefreshEvents = () => {
    void queryClient.invalidateQueries({ queryKey: getListMatchEventsQueryKey(matchId!) });
  };

  if (matchLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Card className="animate-pulse">
          <CardContent className="p-8 space-y-4">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-16 bg-muted rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const detail = match as MatchDetail | undefined;
  if (!detail) return <div className="text-center py-10 text-muted-foreground">Match not found.</div>;

  const isLive = detail.status === "live";

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
      {/* ── Match header ──────────────────────────────────── */}
      <Card className={`border-t-4 overflow-hidden ${isLive ? "border-t-green-500" : "border-t-primary"}`}>
        <CardContent className="p-4 sm:p-8 space-y-4 sm:space-y-6">
          {/* Meta row */}
          <div className="flex flex-wrap justify-between items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <span className="truncate max-w-[55%]">
              {detail.tournament} · {detail.stage}
            </span>
            <div className="flex items-center gap-2">
              {isLive && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />}
              <span className={`px-2 py-0.5 rounded font-bold ${isLive ? "text-green-600 bg-green-500/10" : "bg-secondary"}`}>
                {detail.status.toUpperCase()}
              </span>
            </div>
            <span className="font-mono font-normal text-muted-foreground/70">
              {new Date(detail.kickoffAt).toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          {/* Score */}
          <div className="flex justify-center items-center gap-4 sm:gap-8 md:gap-16">
            <div className="flex-1 text-right min-w-0">
              <h2 className="text-xl sm:text-3xl md:text-4xl font-extrabold leading-tight">{detail.homeTeam}</h2>
              <span className="text-xs text-muted-foreground">Home</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 bg-secondary px-5 sm:px-8 py-3 sm:py-5 rounded-2xl shadow-inner shrink-0">
              <span className="text-4xl sm:text-5xl md:text-7xl font-mono font-black tabular-nums">
                {detail.homeScore ?? "–"}
              </span>
              <span className="text-lg text-muted-foreground font-thin">:</span>
              <span className="text-4xl sm:text-5xl md:text-7xl font-mono font-black tabular-nums">
                {detail.awayScore ?? "–"}
              </span>
            </div>
            <div className="flex-1 text-left min-w-0">
              <h2 className="text-xl sm:text-3xl md:text-4xl font-extrabold leading-tight">{detail.awayTeam}</h2>
              <span className="text-xs text-muted-foreground">Away</span>
            </div>
          </div>

          {/* Proof status */}
          {detail.proofStatus && (
            <div className="pt-4 border-t flex items-center gap-2 justify-center flex-wrap">
              <span className="text-sm text-muted-foreground">Proof:</span>
              <span className="text-sm font-mono font-bold bg-secondary px-2 py-1 rounded">{detail.proofStatus}</span>
              <Link href={`/proofs?matchId=${detail.id}`}>
                <Button variant="link" size="sm" className="h-auto p-0 text-xs">View Proofs →</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Markets + Timeline ──────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
        {/* Markets (2/3 on desktop) */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl sm:text-2xl font-bold">Markets</h3>
            <span className="text-xs text-muted-foreground font-mono">
              {markets.length} market{markets.length !== 1 ? "s" : ""}
            </span>
          </div>
          {marketsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse"><CardContent className="p-4 h-24" /></Card>
              ))}
            </div>
          ) : !markets.length ? (
            <div className="p-6 text-center bg-card border rounded text-sm text-muted-foreground">
              No markets yet for this match.
            </div>
          ) : (
            <div className="space-y-3">
              {markets.map((market) => <MarketCard key={market.id} market={market} />)}
            </div>
          )}
        </div>

        {/* Timeline (1/3 on desktop) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl sm:text-2xl font-bold">Timeline</h3>
            <div className="flex items-center gap-2">
              {events.length > 0 && (
                <span className="text-xs text-muted-foreground font-mono">
                  {events.length} event{events.length !== 1 ? "s" : ""}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={handleRefreshEvents}
                disabled={eventsLoading}
              >
                {eventsLoading ? "…" : "↻ Refresh"}
              </Button>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto pr-1 pb-2">
            {eventsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <Timeline events={events} matchStatus={detail.status} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
