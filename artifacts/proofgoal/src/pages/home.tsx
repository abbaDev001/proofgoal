import { useGetAnalyticsSummary, useListMatches } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLamports } from "@/lib/format";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export function HomePage() {
  const { data: analytics, isLoading: analyticsLoading } = useGetAnalyticsSummary();
  const { data: allMatchesRaw, isLoading: matchesLoading } = useListMatches();
  const allMatches = Array.isArray(allMatchesRaw) ? allMatchesRaw : [];

  // Show live first, then upcoming scheduled, skip finished
  const liveMatches = allMatches.filter((m) => m.status === "live");
  const upcomingMatches = allMatches
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime())
    .slice(0, 6);
  const displayMatches = liveMatches.length > 0 ? liveMatches : upcomingMatches;
  const sectionLabel = liveMatches.length > 0 ? "Live Matches" : "Upcoming Matches";

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Terminal Overview</h1>
        <p className="text-sm text-muted-foreground">Platform analytics and live market status.</p>
      </div>

      {/* Stats grid — 2 cols on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Volume
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-xl sm:text-2xl font-bold font-mono">
              {analyticsLoading ? "—" : `${formatLamports(analytics?.totalVolumeLamports || 0)} SOL`}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Open Interest
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-xl sm:text-2xl font-bold font-mono">
              {analyticsLoading ? "—" : `${formatLamports(analytics?.openInterestLamports || 0)} SOL`}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Active Markets
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-xl sm:text-2xl font-bold font-mono">
              {analyticsLoading ? "—" : analytics?.activeMarkets || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="text-xl sm:text-2xl font-bold font-mono">
              {analyticsLoading ? "—" : analytics?.totalUsers || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Matches section */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold">{sectionLabel}</h2>
            {liveMatches.length > 0 && (
              <span className="h-2 w-2 rounded-full bg-accent animate-pulse inline-block" />
            )}
          </div>
          <Link href="/matches">
            <Button variant="outline" size="sm" className="text-xs h-7 px-2 sm:h-9 sm:px-4 sm:text-sm">
              View All
            </Button>
          </Link>
        </div>

        {matchesLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed">
            Loading matches…
          </div>
        ) : displayMatches.length === 0 ? (
          <div className="text-sm text-muted-foreground py-10 text-center border rounded border-dashed bg-card">
            <p className="font-medium mb-1">No matches yet</p>
            <p className="text-xs">TxLINE oracle syncs every 60 seconds.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {displayMatches.map((match) => (
              <Link key={match.id} href={`/matches/${match.id}`}>
                <Card className="hover:border-primary transition-colors cursor-pointer">
                  <CardContent className="p-3 sm:p-4">
                    {/* Tournament + status row */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground truncate max-w-[70%]">
                        {match.tournament} · {match.stage}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          match.status === "live"
                            ? "bg-green-500/10 text-green-600 animate-pulse"
                            : match.status === "finished"
                            ? "bg-secondary text-muted-foreground"
                            : "bg-blue-500/10 text-blue-600"
                        }`}
                      >
                        {match.status === "scheduled"
                          ? new Date(match.kickoffAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })
                          : match.status}
                      </span>
                    </div>
                    {/* Teams + score */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm sm:text-base truncate">{match.homeTeam}</div>
                        <div className="font-bold text-sm sm:text-base truncate">{match.awayTeam}</div>
                      </div>
                      {(match.status === "live" || match.status === "finished") ? (
                        <div className="text-2xl font-bold font-mono bg-secondary px-3 py-1 rounded shrink-0 text-center leading-tight">
                          <div>{match.homeScore ?? 0}</div>
                          <div>{match.awayScore ?? 0}</div>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground font-mono bg-secondary px-2 py-1 rounded shrink-0 text-center">
                          {new Date(match.kickoffAt).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { href: "/markets", label: "Browse Markets", desc: "Prediction markets" },
          { href: "/insurance", label: "Get Coverage", desc: "Insurance products" },
          { href: "/governance", label: "Governance", desc: "Proposals & pools" },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="hover:border-primary transition-colors cursor-pointer h-full">
              <CardContent className="p-3 sm:p-4">
                <div className="font-semibold text-sm mb-0.5">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.desc}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
