import { useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useGetPortfolioSummary, getGetPortfolioSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatLamports } from "@/lib/format";
import { useAppWallet, useSolBalance } from "@/lib/wallet";
import { Link } from "wouter";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import type { PortfolioSummary } from "@workspace/api-zod";

interface LiquidityPositionWithPool {
  id: string;
  poolId: string;
  walletAddress: string;
  depositedLamports: number;
  accruedYieldLamports: number;
  depositedAt: string;
  pool: { marketType: string; aprBps: number };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  pending:  "bg-blue-500/10 text-blue-600",
  won:      "bg-amber-500/15 text-amber-600",
  claimed:  "bg-green-500/15 text-green-600",
  lost:     "bg-secondary text-muted-foreground",
  void:     "bg-secondary text-muted-foreground",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Open",
  won:     "Won — Claim",
  claimed: "Paid Out",
  lost:    "Lost",
  void:    "Void",
};

const EXPLORER_BASE =
  process.env.NODE_ENV === "production"
    ? "https://explorer.solana.com/tx"
    : "https://explorer.solana.com/tx";
const CLUSTER_SUFFIX = "?cluster=devnet";

function solExplorerUrl(sig: string) {
  return `${EXPLORER_BASE}/${sig}${CLUSTER_SUFFIX}`;
}

// ── Claim button ──────────────────────────────────────────────────────────────

function ClaimButton({
  positionId,
  walletAddress,
  payoutLamports,
  onClaimed,
}: {
  positionId: string;
  walletAddress: string;
  payoutLamports: number;
  onClaimed: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClaim = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/positions/${positionId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
      const data = (await res.json()) as { error?: string; payoutTxSig?: string };
      if (!res.ok) throw new Error(data.error ?? "Claim failed");
      onClaimed();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" onClick={handleClaim} disabled={loading} className="bg-amber-500 hover:bg-amber-600 text-white text-xs">
        {loading ? "Sending…" : `Claim ${formatLamports(payoutLamports)} SOL`}
      </Button>
      {error && <p className="text-[10px] text-red-500 max-w-[180px] text-right">{error}</p>}
    </div>
  );
}

// ── Position card ─────────────────────────────────────────────────────────────

type PositionRow = PortfolioSummary["positions"][number];

function PositionCard({ pos, walletAddress, onRefresh }: { pos: PositionRow; walletAddress: string; onRefresh: () => void }) {
  const isWon     = pos.status === "won";
  const isClaimed = pos.status === "claimed";
  const isLost    = pos.status === "lost";
  const isPending = pos.status === "pending";

  const payoutSig = (pos as PositionRow & { payoutTxSig?: string | null }).payoutTxSig;

  return (
    <Card className={`${isWon ? "border-amber-400/50" : isClaimed ? "border-green-400/30" : ""}`}>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
          {/* Left: amounts */}
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">
                Staked: <span className="font-mono">{formatLamports(pos.stakeLamports)} SOL</span>
              </span>
              {(isWon || isClaimed || isPending) && (
                <span className="text-xs text-muted-foreground">
                  → Payout: <span className={`font-mono font-bold ${isClaimed ? "text-green-600" : isWon ? "text-amber-600" : ""}`}>
                    {formatLamports(pos.potentialPayoutLamports)} SOL
                  </span>
                </span>
              )}
            </div>
            {pos.settlementTxSig && (
              <a
                href={solExplorerUrl(pos.settlementTxSig)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono text-muted-foreground hover:text-primary truncate max-w-[200px]"
              >
                Stake tx: {pos.settlementTxSig.slice(0, 16)}…
              </a>
            )}
            {isClaimed && payoutSig && (
              <a
                href={solExplorerUrl(payoutSig)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono text-green-600 hover:underline truncate max-w-[200px]"
              >
                ✓ Payout tx: {payoutSig.slice(0, 16)}…
              </a>
            )}
            {isLost && (
              <span className="text-[10px] text-muted-foreground">Better luck next time.</span>
            )}
          </div>

          {/* Right: status badge or claim button */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            {isWon ? (
              <ClaimButton
                positionId={pos.id}
                walletAddress={walletAddress}
                payoutLamports={pos.potentialPayoutLamports}
                onClaimed={onRefresh}
              />
            ) : (
              <span className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-wider font-bold ${STATUS_STYLES[pos.status] ?? "bg-muted text-muted-foreground"}`}>
                {STATUS_LABELS[pos.status] ?? pos.status}
              </span>
            )}
            {pos.settledAt && (
              <span className="text-[9px] text-muted-foreground font-mono">
                {new Date(pos.settledAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function PortfolioPage() {
  const { walletAddress } = useAppWallet();
  const { setVisible } = useWalletModal();
  const solBalance = useSolBalance();
  const queryClient = useQueryClient();

  const { data: portfolio, isLoading } = useGetPortfolioSummary<PortfolioSummary>(
    walletAddress ?? "",
    {
      query: {
        enabled: Boolean(walletAddress),
        queryKey: getGetPortfolioSummaryQueryKey(walletAddress ?? ""),
        refetchInterval: 30_000,
      } as never,
    },
  );

  const { data: lpPositionsRaw, isLoading: lpLoading } = useQuery<LiquidityPositionWithPool[]>({
    queryKey: ["liquidity-positions", walletAddress],
    queryFn: () =>
      fetch(`/api/liquidity/positions?walletAddress=${walletAddress}`)
        .then((r) => r.json() as Promise<LiquidityPositionWithPool[]>),
    enabled: Boolean(walletAddress),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
  const lpPositions = Array.isArray(lpPositionsRaw) ? lpPositionsRaw : [];

  const onRefresh = () => {
    void queryClient.invalidateQueries({
      queryKey: getGetPortfolioSummaryQueryKey(walletAddress ?? ""),
    });
    void queryClient.invalidateQueries({
      queryKey: ["liquidity-positions", walletAddress],
    });
  };

  if (!walletAddress) {
    return (
      <div className="text-center py-16 border rounded border-dashed bg-card space-y-4 px-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Portfolio</h2>
          <p className="text-sm text-muted-foreground">
            Connect your wallet to view positions and policies.
          </p>
        </div>
        <Button onClick={() => setVisible(true)}>Connect Wallet</Button>
      </div>
    );
  }

  // Count won positions waiting to be claimed
  const positions = portfolio?.positions ?? [];
  const wonCount = positions.filter((p) => p.status === "won").length;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Portfolio</h1>
          <p className="text-sm text-muted-foreground">Your positions and insurance policies.</p>
        </div>
        {wonCount > 0 && (
          <div className="bg-amber-500/10 border border-amber-400/30 rounded-lg px-3 py-2 text-sm text-amber-700 font-medium shrink-0">
            🏆 {wonCount} winning bet{wonCount !== 1 ? "s" : ""} ready to claim!
          </div>
        )}
      </div>

      {/* Wallet balance */}
      <Card className="border-primary/30">
        <CardContent className="p-4 sm:p-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Wallet Balance (Devnet)
            </p>
            <p className="text-2xl sm:text-3xl font-bold font-mono">
              {solBalance !== null ? `${solBalance.toFixed(4)} SOL` : "Loading…"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              Connected
            </div>
            <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[160px]">
              {walletAddress.slice(0, 8)}…{walletAddress.slice(-6)}
            </span>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed">
          Loading portfolio…
        </div>
      ) : portfolio ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {[
              { label: "Total Staked",   value: `${formatLamports(portfolio.totalStakedLamports)} SOL` },
              { label: "Premium Paid",   value: `${formatLamports(portfolio.totalPremiumPaidLamports)} SOL` },
              { label: "Open Positions", value: portfolio.openPositions },
              { label: "Active Policies",value: portfolio.activePolicies },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardHeader className="pb-1 p-3 sm:p-6">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {stat.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0">
                  <div className="text-lg sm:text-2xl font-bold font-mono">{stat.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Positions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-bold">Positions</h2>
              <Button variant="ghost" size="sm" className="text-xs" onClick={onRefresh}>
                ↻ Refresh
              </Button>
            </div>
            {!positions.length ? (
              <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed bg-card">
                No positions yet.{" "}
                <Link href="/matches" className="text-primary hover:underline">
                  Browse matches →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {positions
                  .slice()
                  .sort((a, b) => {
                    // Won first, then pending, then claimed/lost
                    const order: Record<string, number> = { won: 0, pending: 1, claimed: 2, lost: 3, void: 4 };
                    return (order[a.status] ?? 9) - (order[b.status] ?? 9);
                  })
                  .map((pos) => (
                    <PositionCard
                      key={pos.id}
                      pos={pos}
                      walletAddress={walletAddress}
                      onRefresh={onRefresh}
                    />
                  ))}
              </div>
            )}
          </div>

          {/* Insurance Policies */}
          <div className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold">Insurance Policies</h2>
            {!portfolio.policies.length ? (
              <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed bg-card">
                No policies yet.{" "}
                <Link href="/insurance" className="text-primary hover:underline">
                  Browse insurance →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {portfolio.policies.map((policy) => (
                  <Card key={policy.id}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start sm:items-center justify-between gap-3">
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="text-sm font-medium truncate">
                            Product: {policy.productId}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            Premium: {formatLamports(policy.premiumPaidLamports)} SOL · Coverage:{" "}
                            {formatLamports(policy.coverageLamports)} SOL
                          </span>
                        </div>
                        <span className="text-[10px] px-2 py-1 rounded-full uppercase tracking-wider font-bold shrink-0 bg-muted text-muted-foreground">
                          {policy.status}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          {/* My Liquidity */}
          <div className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold">My Liquidity</h2>
            {lpLoading ? (
              <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed">
                Loading liquidity positions…
              </div>
            ) : !lpPositions.length ? (
              <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed bg-card">
                No liquidity positions yet.{" "}
                <Link href="/governance" className="text-primary hover:underline">
                  Browse pools →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {lpPositions.map((pos) => (
                  <Card key={pos.id}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="text-sm font-semibold uppercase tracking-wide">
                            {pos.pool.marketType.replace(/_/g, " ")}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            Principal: {formatLamports(pos.depositedLamports)} SOL
                          </span>
                          <span className="text-xs font-mono text-green-600">
                            Accrued Yield: +{formatLamports(pos.accruedYieldLamports)} SOL
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-xs font-bold text-primary font-mono">
                            {(pos.pool.aprBps / 100).toFixed(1)}% APR
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            Total: {formatLamports(pos.depositedLamports + pos.accruedYieldLamports)} SOL
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
