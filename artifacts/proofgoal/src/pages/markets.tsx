import { useState } from "react";
import { useListMarkets } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { formatLamports, formatOdds } from "@/lib/format";
import { MarketStatus, MarketType } from "@workspace/api-zod";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "suspended", label: "Suspended" },
  { value: "settled", label: "Settled" },
];

export function MarketsPage() {
  const [filterStatus, setFilterStatus] = useState<MarketStatus | "">("");

  const { data: marketsRaw, isLoading } = useListMarkets({
    status: filterStatus ? (filterStatus as MarketStatus) : undefined,
  });
  const markets = Array.isArray(marketsRaw) ? marketsRaw : [];

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Markets</h1>
          <p className="text-sm text-muted-foreground">Browse and trade prediction markets.</p>
        </div>
        {/* Status filter pills */}
        <div className="flex gap-1 bg-secondary rounded-lg p-1 self-start sm:self-auto">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterStatus(opt.value as MarketStatus | "")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filterStatus === opt.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed">
          Loading markets…
        </div>
      ) : !markets.length ? (
        <div className="text-sm text-muted-foreground py-10 text-center border rounded border-dashed bg-card">
          <p className="font-medium mb-1">No markets available</p>
          <p className="text-xs">Markets open once match data is synced from the oracle.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {markets.map((market) => (
            <Link key={market.id} href={`/markets/${market.id}`}>
              <Card className="hover:border-primary transition-colors cursor-pointer h-full flex flex-col">
                <CardHeader className="pb-2 p-4">
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-sm sm:text-base leading-tight">{market.title}</CardTitle>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold shrink-0 ${
                        market.status === "open"
                          ? "bg-primary/10 text-primary"
                          : market.status === "settled"
                            ? "bg-muted text-muted-foreground"
                            : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {market.status}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-end p-4 pt-0">
                  {/* Selections */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {market.selections.slice(0, 2).map((sel) => (
                      <div key={sel.id} className="bg-secondary rounded p-2 text-center">
                        <div
                          className="text-[10px] text-muted-foreground truncate mb-0.5"
                          title={sel.label}
                        >
                          {sel.label}
                        </div>
                        <div className="font-mono font-bold text-base sm:text-lg">
                          {formatOdds(sel.odds)}
                        </div>
                      </div>
                    ))}
                    {market.selections.length > 2 && (
                      <div className="col-span-2 text-center text-[10px] text-muted-foreground">
                        +{market.selections.length - 2} more options
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono border-t pt-2">
                    <span>Liq: {formatLamports(market.liquidityLamports)} SOL</span>
                    <span className="uppercase">{market.type.replace(/_/g, " ")}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
