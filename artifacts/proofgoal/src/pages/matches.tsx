import { useMemo, useState } from "react";
import {
  useListMatches,
  getListMatchesQueryKey,
  type Match,
  type MatchStatus,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";

type StatusFilter = "all" | MatchStatus;

const TABS: { value: StatusFilter; label: string }[] = [
  { value: "all",       label: "All"       },
  { value: "live",      label: "Live"      },
  { value: "scheduled", label: "Scheduled" },
  { value: "finished",  label: "Finished"  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    live:      "bg-green-500/15 text-green-600 animate-pulse",
    scheduled: "bg-primary/10 text-primary",
    finished:  "bg-secondary text-muted-foreground",
    postponed: "bg-orange-500/10 text-orange-600",
  };
  return (
    <span className={`text-[9px] px-2 py-0.5 rounded-full uppercase font-bold shrink-0 ${styles[status] ?? "bg-secondary text-muted-foreground"}`}>
      {status}
    </span>
  );
}

function TeamRow({ name, score, showScore }: { name: string; score: number | null; showScore: boolean }) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="font-semibold text-sm truncate max-w-[72%]">{name}</span>
      <span className={`text-xl font-mono font-bold tabular-nums min-w-[24px] text-right ${showScore && score != null ? "text-foreground" : "text-muted-foreground/40"}`}>
        {showScore ? (score ?? "–") : "–"}
      </span>
    </div>
  );
}

function MatchCard({ match }: { match: Match }) {
  const isLive     = match.status === "live";
  const isFinished = match.status === "finished";
  const showScore  = isLive || isFinished;

  return (
    <Link href={`/matches/${match.id}`}>
      <Card className={`hover:border-primary/60 transition-all duration-150 cursor-pointer h-full ${isLive ? "border-green-500 shadow-green-500/10 shadow-md" : ""}`}>
        <CardContent className="p-4 space-y-3">
          {/* Tournament + badge */}
          <div className="flex justify-between items-start gap-2">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider leading-tight max-w-[60%] line-clamp-2">
              {match.tournament} · {match.stage}
            </span>
            <StatusBadge status={match.status} />
          </div>

          {/* Teams + scores */}
          <div className="space-y-1.5">
            <TeamRow name={match.homeTeam} score={match.homeScore} showScore={showScore} />
            <TeamRow name={match.awayTeam} score={match.awayScore} showScore={showScore} />
          </div>

          {/* Footer */}
          <div className="pt-2 border-t text-[10px] text-muted-foreground font-mono flex items-center justify-between">
            <span>
              {new Date(match.kickoffAt).toLocaleString(undefined, {
                month:  "short",
                day:    "numeric",
                hour:   "2-digit",
                minute: "2-digit",
              })}
            </span>
            {isFinished && showScore && <span className="font-bold text-primary">FT</span>}
            {isLive     && <span className="text-green-500 font-bold animate-pulse">LIVE</span>}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function MatchesPage() {
  const [activeTab, setActiveTab] = useState<StatusFilter>("all");

  // Always fetch all matches; filter client-side so tabs can show counts
  const { data: matchesRaw, isLoading } = useListMatches(undefined, {
    query: {
      queryKey: getListMatchesQueryKey(),
      refetchInterval: 30_000,
    },
  });
  const allMatches: Match[] = useMemo(
    () => (Array.isArray(matchesRaw) ? (matchesRaw as Match[]) : []),
    [matchesRaw],
  );

  const counts = useMemo(() => ({
    all:       allMatches.length,
    live:      allMatches.filter((m) => m.status === "live").length,
    scheduled: allMatches.filter((m) => m.status === "scheduled").length,
    finished:  allMatches.filter((m) => m.status === "finished").length,
  }), [allMatches]);

  const filtered = useMemo(
    () => activeTab === "all" ? allMatches : allMatches.filter((m) => m.status === activeTab),
    [allMatches, activeTab],
  );

  // Sort: live first → scheduled soonest → finished most-recent
  const sorted = useMemo(() => {
    const order: Record<string, number> = { live: 0, scheduled: 1, finished: 2, postponed: 3 };
    return [...filtered].sort((a, b) => {
      const sd = (order[a.status] ?? 9) - (order[b.status] ?? 9);
      if (sd !== 0) return sd;
      const ta = new Date(a.kickoffAt).getTime();
      const tb = new Date(b.kickoffAt).getTime();
      return a.status === "finished" ? tb - ta : ta - tb;
    });
  }, [filtered]);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Matches</h1>
          <p className="text-sm text-muted-foreground">
            FIFA World Cup 2026 fixtures · synced via TxLINE oracle
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-secondary rounded-lg p-1 self-start sm:self-auto">
          {TABS.map((tab) => {
            const count = counts[tab.value as keyof typeof counts] ?? 0;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === tab.value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                {!isLoading && count > 0 && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                    activeTab === tab.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Match grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 space-y-3">
                <div className="h-3 bg-muted rounded w-2/3" />
                <div className="h-5 bg-muted rounded w-1/2" />
                <div className="h-5 bg-muted rounded w-1/2" />
                <div className="h-3 bg-muted rounded w-1/3 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !sorted.length ? (
        <div className="text-sm text-muted-foreground py-12 text-center border rounded border-dashed bg-card">
          <p className="font-medium mb-1">
            {activeTab === "all" ? "No match data yet" : `No ${activeTab} matches`}
          </p>
          <p className="text-xs">
            {activeTab === "all"       ? "Waiting for TxLINE oracle sync."     :
             activeTab === "live"      ? "No matches are currently in play."    :
             activeTab === "finished"  ? "No matches have been completed yet."  :
                                        "Check back closer to kick-off."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {sorted.map((match) => <MatchCard key={match.id} match={match} />)}
        </div>
      )}
    </div>
  );
}
