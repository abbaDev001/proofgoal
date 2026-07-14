import { useState } from "react";
import {
  useListInsuranceProducts,
  usePurchaseInsurancePolicy,
  useListMatches,
  getListMatchesQueryKey,
  useListInsurancePolicies,
  getListInsurancePoliciesQueryKey,
  type Match,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatLamports } from "@/lib/format";
import { useAppWallet } from "@/lib/wallet";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// Insurance product types that require match + team selection
const MATCH_REQUIRED_TYPES = new Set([
  "favorite_team_loss",
  "tournament_exit",
  "qualification",
  "goal_insurance",
]);

interface AppConfig {
  treasuryWallet: string | null;
  network: string;
}

// ── Policy status badge ────────────────────────────────────────────────────────
const POLICY_STATUS_STYLES: Record<string, string> = {
  active:    "bg-blue-500/10 text-blue-600",
  triggered: "bg-amber-500/15 text-amber-600",
  claimed:   "bg-green-500/15 text-green-600",
  expired:   "bg-secondary text-muted-foreground",
  void:      "bg-secondary text-muted-foreground",
};

const POLICY_STATUS_LABELS: Record<string, string> = {
  active:    "Active",
  triggered: "Triggered — Claim",
  claimed:   "Paid Out",
  expired:   "Expired",
  void:      "Void",
};

// ── Claim button for triggered policies ───────────────────────────────────────
function ClaimPolicyButton({
  policyId,
  walletAddress,
  payoutLamports,
  onClaimed,
}: {
  policyId: string;
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
      const res = await fetch(`/api/insurance/policies/${policyId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
      const data = (await res.json()) as { error?: string; claimTxSig?: string };
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
      <Button
        size="sm"
        onClick={handleClaim}
        disabled={loading}
        className="bg-amber-500 hover:bg-amber-600 text-white text-xs"
      >
        {loading ? "Sending…" : `Claim ${formatLamports(payoutLamports)} SOL`}
      </Button>
      {error && <p className="text-[10px] text-red-500 max-w-[180px] text-right">{error}</p>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function InsurancePage() {
  const { data: productsRaw, isLoading } = useListInsuranceProducts({});
  const products = Array.isArray(productsRaw) ? productsRaw : [];
  const { walletAddress } = useAppWallet();
  const { sendTransaction, publicKey: userPublicKey } = useWallet();
  const { connection } = useConnection();
  const purchaseMutation = usePurchaseInsurancePolicy();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Per-product form state
  const [coverageByProduct, setCoverageByProduct] = useState<Record<string, string>>({});
  const [selectedMatchByProduct, setSelectedMatchByProduct] = useState<Record<string, string>>({});
  const [selectedTeamByProduct, setSelectedTeamByProduct] = useState<Record<string, string>>({});
  const [isSendingTxByProduct, setIsSendingTxByProduct] = useState<Record<string, boolean>>({});

  // Fetch matches for the match picker
  const { data: matchesRaw } = useListMatches(undefined, {
    query: { queryKey: getListMatchesQueryKey(), staleTime: 60_000 },
  });
  const allMatches: Match[] = Array.isArray(matchesRaw) ? (matchesRaw as Match[]) : [];
  const upcomingMatches = allMatches.filter(
    (m) => m.status === "scheduled" || m.status === "live",
  );

  // Fetch treasury config for on-chain transfers
  const { data: appConfig } = useQuery<AppConfig>({
    queryKey: ["app-config"],
    queryFn: () => fetch("/api/config").then((r) => r.json() as Promise<AppConfig>),
    staleTime: Infinity,
  });

  // My Policies
  const {
    data: policiesRaw,
    isLoading: policiesLoading,
    refetch: refetchPolicies,
  } = useListInsurancePolicies(
    { walletAddress: walletAddress ?? "" },
    {
      query: {
        enabled: Boolean(walletAddress),
        queryKey: getListInsurancePoliciesQueryKey({ walletAddress: walletAddress ?? "" }),
        refetchInterval: 30_000,
      },
    },
  );
  const myPolicies = Array.isArray(policiesRaw) ? policiesRaw : [];

  const handlePurchase = async (productId: string, productType: string, maxCoverageLamports: number) => {
    if (!walletAddress) {
      toast({ title: "Connect your wallet first", variant: "destructive" });
      return;
    }
    const coverageSol = coverageByProduct[productId];
    const coverageLamports = Math.round(Number(coverageSol || 0) * 1e9);
    if (!coverageLamports || coverageLamports <= 0) {
      toast({ title: "Enter a valid coverage amount", variant: "destructive" });
      return;
    }
    if (coverageLamports > maxCoverageLamports) {
      toast({ title: "Coverage exceeds product maximum", variant: "destructive" });
      return;
    }

    const needsMatch = MATCH_REQUIRED_TYPES.has(productType);
    const matchId = selectedMatchByProduct[productId];
    const selectedTeam = selectedTeamByProduct[productId];

    if (needsMatch && !matchId) {
      toast({ title: "Select a match for this product", variant: "destructive" });
      return;
    }
    if (needsMatch && !selectedTeam) {
      toast({ title: "Select a team to back", variant: "destructive" });
      return;
    }

    // Compute premium to determine on-chain transfer amount
    // We need the product premiumRateBps from the product list
    const product = products.find((p) => p.id === productId);
    const premiumLamports = product
      ? Math.round((coverageLamports * product.premiumRateBps) / 10_000)
      : 0;

    let txSignature: string | undefined;

    // Send real SOL premium if treasury configured and wallet connected
    if (appConfig?.treasuryWallet && userPublicKey && premiumLamports > 0) {
      try {
        setIsSendingTxByProduct((prev) => ({ ...prev, [productId]: true }));
        toast({ title: "Sending premium…", description: "Approve the transaction in your wallet." });

        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: userPublicKey,
            toPubkey: new PublicKey(appConfig.treasuryWallet),
            lamports: premiumLamports,
          }),
        );
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = userPublicKey;

        txSignature = await sendTransaction(tx, connection);
        await connection.confirmTransaction(
          { signature: txSignature, blockhash, lastValidBlockHeight },
          "confirmed",
        );
        toast({ title: "Premium paid ✓", description: `${(premiumLamports / LAMPORTS_PER_SOL).toFixed(6)} SOL transferred on-chain.` });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Transaction rejected";
        toast({ title: "Transaction failed", description: msg, variant: "destructive" });
        setIsSendingTxByProduct((prev) => ({ ...prev, [productId]: false }));
        return;
      } finally {
        setIsSendingTxByProduct((prev) => ({ ...prev, [productId]: false }));
      }
    }

    try {
      await purchaseMutation.mutateAsync({
        data: {
          walletAddress,
          productId,
          coverageLamports,
          matchId: matchId ?? null,
          // Extra fields hand-wired — not in generated schema but accepted by server
          ...(selectedTeam ? { selectedTeam } : {}),
          ...(txSignature ? { txSignature } : {}),
        } as Parameters<typeof purchaseMutation.mutateAsync>[0]["data"],
      });
      toast({ title: "Policy purchased successfully" });
      // Reset form for this product
      setCoverageByProduct((prev) => ({ ...prev, [productId]: "" }));
      setSelectedMatchByProduct((prev) => ({ ...prev, [productId]: "" }));
      setSelectedTeamByProduct((prev) => ({ ...prev, [productId]: "" }));
      // Refresh policies list
      void queryClient.invalidateQueries({
        queryKey: getListInsurancePoliciesQueryKey({ walletAddress }),
      });
    } catch {
      toast({ title: "Failed to purchase policy", variant: "destructive" });
    }
  };

  const selectedMatchForProduct = (productId: string) =>
    allMatches.find((m) => m.id === selectedMatchByProduct[productId]);

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Insurance</h1>
        <p className="text-sm text-muted-foreground">
          Protect your positions with on-chain coverage products.
        </p>
      </div>

      {/* Products */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed">
          Loading insurance products…
        </div>
      ) : !products.length ? (
        <div className="text-sm text-muted-foreground py-10 text-center border rounded border-dashed bg-card">
          No insurance products available yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {products.map((product) => {
            const needsMatch = MATCH_REQUIRED_TYPES.has(product.type);
            const pickedMatch = selectedMatchForProduct(product.id);
            const isSendingTx = isSendingTxByProduct[product.id] ?? false;
            const coverageSol = Number(coverageByProduct[product.id] || 0);
            const premiumSol = coverageSol > 0
              ? ((coverageSol * product.premiumRateBps) / 10_000).toFixed(6)
              : null;

            return (
              <Card key={product.id} className="flex flex-col">
                <CardHeader className="pb-2 p-4">
                  <CardTitle className="text-base leading-tight">{product.name}</CardTitle>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {product.type.replace(/_/g, " ")}
                  </p>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-3 p-4 pt-0">
                  <p className="text-xs text-muted-foreground leading-relaxed">{product.description}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-secondary rounded p-2">
                      <div className="text-muted-foreground text-[10px] uppercase mb-1">Premium</div>
                      <div className="font-bold">{(product.premiumRateBps / 100).toFixed(2)}%</div>
                    </div>
                    <div className="bg-secondary rounded p-2">
                      <div className="text-muted-foreground text-[10px] uppercase mb-1">Max Cover</div>
                      <div className="font-bold">{formatLamports(product.maxCoverageLamports)} SOL</div>
                    </div>
                  </div>

                  {/* Match picker — only for match-outcome products */}
                  {needsMatch && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Select Match
                      </label>
                      <select
                        className="w-full text-xs border rounded px-2 py-1.5 bg-background"
                        value={selectedMatchByProduct[product.id] ?? ""}
                        onChange={(e) => {
                          setSelectedMatchByProduct((prev) => ({ ...prev, [product.id]: e.target.value }));
                          setSelectedTeamByProduct((prev) => ({ ...prev, [product.id]: "" }));
                        }}
                      >
                        <option value="">Choose a match…</option>
                        {upcomingMatches.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.homeTeam} vs {m.awayTeam}
                          </option>
                        ))}
                      </select>

                      {/* Team selector */}
                      {pickedMatch && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Team to Back
                          </label>
                          <div className="flex gap-2">
                            {[pickedMatch.homeTeam, pickedMatch.awayTeam].map((team) => (
                              <button
                                key={team}
                                type="button"
                                onClick={() =>
                                  setSelectedTeamByProduct((prev) => ({ ...prev, [product.id]: team }))
                                }
                                className={`flex-1 text-xs px-2 py-1.5 rounded border transition-colors ${
                                  selectedTeamByProduct[product.id] === team
                                    ? "border-primary bg-primary/10 text-primary font-bold"
                                    : "border-border hover:border-primary/50"
                                }`}
                              >
                                {team}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-auto space-y-2">
                    <Input
                      type="number"
                      placeholder="Coverage amount (SOL)"
                      min="0"
                      step="0.1"
                      value={coverageByProduct[product.id] || ""}
                      onChange={(e) =>
                        setCoverageByProduct((prev) => ({ ...prev, [product.id]: e.target.value }))
                      }
                      className="text-sm"
                    />
                    {premiumSol && (
                      <p className="text-[10px] text-muted-foreground font-mono">
                        Premium: ~{premiumSol} SOL{appConfig?.treasuryWallet && userPublicKey ? " (real SOL)" : " (simulated)"}
                      </p>
                    )}
                    <Button
                      className="w-full"
                      size="sm"
                      disabled={purchaseMutation.isPending || isSendingTx}
                      onClick={() => handlePurchase(product.id, product.type, product.maxCoverageLamports)}
                    >
                      {isSendingTx
                        ? "Confirming on-chain…"
                        : purchaseMutation.isPending
                          ? "Processing…"
                          : "Purchase Policy"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* My Policies */}
      {walletAddress && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold">My Policies</h2>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => void refetchPolicies()}>
              ↻ Refresh
            </Button>
          </div>

          {policiesLoading ? (
            <div className="text-sm text-muted-foreground py-6 text-center border rounded border-dashed">
              Loading policies…
            </div>
          ) : !myPolicies.length ? (
            <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed bg-card">
              No policies yet. Purchase a product above.
            </div>
          ) : (
            <div className="space-y-2">
              {myPolicies.map((policy) => (
                <Card
                  key={policy.id}
                  className={policy.status === "triggered" ? "border-amber-400/50" : ""}
                >
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold font-mono">
                            Cover: {formatLamports(policy.coverageLamports)} SOL
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Premium paid: {formatLamports(policy.premiumPaidLamports)} SOL
                          </span>
                        </div>
                        {policy.claimTxSig && (
                          <a
                            href={`https://explorer.solana.com/tx/${policy.claimTxSig}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-mono text-green-600 hover:underline truncate max-w-[220px]"
                          >
                            ✓ Payout tx: {policy.claimTxSig.slice(0, 16)}…
                          </a>
                        )}
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {new Date(policy.purchasedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {policy.status === "triggered" ? (
                          <ClaimPolicyButton
                            policyId={policy.id}
                            walletAddress={walletAddress}
                            payoutLamports={policy.coverageLamports}
                            onClaimed={() => void refetchPolicies()}
                          />
                        ) : (
                          <span
                            className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-wider font-bold ${
                              POLICY_STATUS_STYLES[policy.status] ?? "bg-muted text-muted-foreground"
                            }`}
                          >
                            {POLICY_STATUS_LABELS[policy.status] ?? policy.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
