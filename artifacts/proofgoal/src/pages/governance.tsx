import { useState } from "react";
import {
  useListGovernanceProposals,
  useCastVote,
  useListLiquidityPools,
  useCreateGovernanceProposal,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatLamports } from "@/lib/format";
import { useAppWallet as useWallet } from "@/lib/wallet";
import { useWallet as useSolanaWallet, useConnection } from "@solana/wallet-adapter-react";
import { Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useToast } from "@/hooks/use-toast";
import { ProposalStatus } from "@workspace/api-zod";
import { useQueryClient, useQuery } from "@tanstack/react-query";

const PROPOSAL_STATUSES = [
  { value: "", label: "All" },
  { value: ProposalStatus.active, label: "Active" },
  { value: ProposalStatus.passed, label: "Passed" },
  { value: ProposalStatus.rejected, label: "Rejected" },
  { value: ProposalStatus.expired, label: "Expired" },
];

interface AppConfig {
  treasuryWallet: string | null;
  network: string;
}

interface LiquidityPositionWithPool {
  id: string;
  poolId: string;
  walletAddress: string;
  depositedLamports: number;
  accruedYieldLamports: number;
  depositedAt: string;
  pool: { marketType: string; aprBps: number };
}

export function GovernancePage() {
  const [filterStatus, setFilterStatus] = useState<ProposalStatus | "">("");
  const { data: proposalsRaw, isLoading } = useListGovernanceProposals({
    status: filterStatus ? (filterStatus as ProposalStatus) : undefined,
  });
  const { data: poolsRaw, isLoading: poolsLoading } = useListLiquidityPools();
  const proposals = Array.isArray(proposalsRaw) ? proposalsRaw : [];
  const pools = Array.isArray(poolsRaw) ? poolsRaw : [];
  const { walletAddress } = useWallet();
  const { sendTransaction, publicKey: userPublicKey } = useSolanaWallet();
  const { connection } = useConnection();
  const castVoteMutation = useCastVote();
  const createProposalMutation = useCreateGovernanceProposal();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch treasury config
  const { data: appConfig } = useQuery<AppConfig>({
    queryKey: ["app-config"],
    queryFn: () => fetch("/api/config").then((r) => r.json() as Promise<AppConfig>),
    staleTime: Infinity,
  });

  // Fetch wallet's LP positions
  const { data: lpPositionsRaw, isLoading: positionsLoading } = useQuery<LiquidityPositionWithPool[]>({
    queryKey: ["liquidity-positions", walletAddress],
    queryFn: () =>
      fetch(`/api/liquidity/positions?walletAddress=${walletAddress}`)
        .then((r) => r.json() as Promise<LiquidityPositionWithPool[]>),
    enabled: Boolean(walletAddress),
    staleTime: 30_000,
  });
  const lpPositions = Array.isArray(lpPositionsRaw) ? lpPositionsRaw : [];

  // Create proposal form state
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newEndsAt, setNewEndsAt] = useState("");

  // Deposit state per pool
  const [depositAmounts, setDepositAmounts] = useState<Record<string, string>>({});
  const [depositLoading, setDepositLoading] = useState<Record<string, boolean>>({});

  // Withdraw state per pool
  const [withdrawAmounts, setWithdrawAmounts] = useState<Record<string, string>>({});
  const [withdrawLoading, setWithdrawLoading] = useState<Record<string, boolean>>({});

  const handleVote = async (proposalId: string, choice: "for" | "against") => {
    if (!walletAddress) {
      toast({ title: "Connect your wallet first", variant: "destructive" });
      return;
    }
    try {
      await castVoteMutation.mutateAsync({
        proposalId,
        data: { walletAddress, choice, weight: 1 },
      });
      toast({ title: "Vote cast successfully" });
      queryClient.invalidateQueries({ queryKey: ["governance"] });
    } catch {
      toast({ title: "Failed to cast vote — you may have already voted", variant: "destructive" });
    }
  };

  const handleCreateProposal = async () => {
    if (!walletAddress) {
      toast({ title: "Connect your wallet first", variant: "destructive" });
      return;
    }
    if (!newTitle.trim() || !newDesc.trim()) {
      toast({ title: "Title and description are required", variant: "destructive" });
      return;
    }
    try {
      await createProposalMutation.mutateAsync({
        data: {
          title: newTitle.trim(),
          description: newDesc.trim(),
          endsAt: newEndsAt ? new Date(newEndsAt).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });
      toast({ title: "Proposal created" });
      setShowCreate(false);
      setNewTitle("");
      setNewDesc("");
      setNewEndsAt("");
      queryClient.invalidateQueries({ queryKey: ["governance"] });
    } catch {
      toast({ title: "Failed to create proposal", variant: "destructive" });
    }
  };

  const handleDeposit = async (poolId: string) => {
    if (!walletAddress) {
      toast({ title: "Connect your wallet first", variant: "destructive" });
      return;
    }
    const solStr = depositAmounts[poolId] ?? "";
    const solAmt = parseFloat(solStr);
    if (isNaN(solAmt) || solAmt <= 0) {
      toast({ title: "Enter a valid SOL amount", variant: "destructive" });
      return;
    }
    const lamports = Math.round(solAmt * LAMPORTS_PER_SOL);

    setDepositLoading((prev) => ({ ...prev, [poolId]: true }));
    let txSignature: string | undefined;

    // Send on-chain transfer if treasury configured
    if (appConfig?.treasuryWallet && userPublicKey) {
      try {
        toast({ title: "Sending SOL…", description: "Approve the transaction in your wallet." });
        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: userPublicKey,
            toPubkey: new PublicKey(appConfig.treasuryWallet),
            lamports,
          }),
        );
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = userPublicKey;
        txSignature = await sendTransaction(tx, connection);
        await connection.confirmTransaction({ signature: txSignature, blockhash, lastValidBlockHeight }, "confirmed");
        toast({ title: "Payment confirmed ✓", description: `${solAmt} SOL transferred on-chain.` });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Transaction rejected";
        toast({ title: "Transaction failed", description: msg, variant: "destructive" });
        setDepositLoading((prev) => ({ ...prev, [poolId]: false }));
        return;
      }
    }

    try {
      const res = await fetch(`/api/liquidity/pools/${poolId}/deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, lamports, txSignature }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Deposit failed");
      toast({ title: "Deposit successful ✓", description: `${solAmt} SOL deposited into pool.` });
      setDepositAmounts((prev) => ({ ...prev, [poolId]: "" }));
      queryClient.invalidateQueries({ queryKey: ["liquidity-positions", walletAddress] });
      queryClient.invalidateQueries({ queryKey: ["listLiquidityPools"] });
    } catch (err) {
      toast({ title: "Deposit failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setDepositLoading((prev) => ({ ...prev, [poolId]: false }));
    }
  };

  const handleWithdraw = async (poolId: string, withdrawAll = false) => {
    if (!walletAddress) {
      toast({ title: "Connect your wallet first", variant: "destructive" });
      return;
    }

    let amountLamports: number | undefined;
    if (!withdrawAll) {
      const solStr = withdrawAmounts[poolId] ?? "";
      const solAmt = parseFloat(solStr);
      if (isNaN(solAmt) || solAmt <= 0) {
        toast({ title: "Enter a valid SOL amount to withdraw", variant: "destructive" });
        return;
      }
      amountLamports = Math.round(solAmt * LAMPORTS_PER_SOL);
    }

    setWithdrawLoading((prev) => ({ ...prev, [poolId]: true }));
    try {
      const res = await fetch(`/api/liquidity/pools/${poolId}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          amountLamports: withdrawAll ? undefined : amountLamports,
        }),
      });
      const data = await res.json() as { error?: string; payoutLamports?: number; payoutTxSig?: string };
      if (!res.ok) throw new Error(data.error ?? "Withdrawal failed");
      const payoutSol = ((data.payoutLamports ?? 0) / LAMPORTS_PER_SOL).toFixed(4);
      toast({ title: "Withdrawal successful ✓", description: `${payoutSol} SOL sent to your wallet.` });
      setWithdrawAmounts((prev) => ({ ...prev, [poolId]: "" }));
      queryClient.invalidateQueries({ queryKey: ["liquidity-positions", walletAddress] });
      queryClient.invalidateQueries({ queryKey: ["listLiquidityPools"] });
    } catch (err) {
      toast({ title: "Withdrawal failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setWithdrawLoading((prev) => ({ ...prev, [poolId]: false }));
    }
  };

  // Build a map of poolId -> position for quick lookup
  const positionByPool = new Map(lpPositions.map((p) => [p.poolId, p]));

  return (
    <div className="space-y-8 sm:space-y-10">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Governance & Liquidity</h1>
        <p className="text-sm text-muted-foreground">
          Vote on platform proposals and provide liquidity to earn yield.
        </p>
      </div>

      {/* Proposals section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <h2 className="text-lg sm:text-xl font-bold">Proposals</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex flex-wrap gap-1 bg-secondary rounded-lg p-1">
              {PROPOSAL_STATUSES.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFilterStatus(opt.value as ProposalStatus | "")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    filterStatus === opt.value
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => setShowCreate((v) => !v)}>
              {showCreate ? "Cancel" : "+ New Proposal"}
            </Button>
          </div>
        </div>

        {showCreate && (
          <Card className="border-dashed">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-semibold">Create Governance Proposal</p>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Title</Label>
                  <Input
                    className="mt-1 text-sm"
                    placeholder="Proposal title…"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Description</Label>
                  <Input
                    className="mt-1 text-sm"
                    placeholder="Describe what you're proposing and why…"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Voting ends (optional)</Label>
                  <Input
                    type="datetime-local"
                    className="mt-1 text-sm"
                    value={newEndsAt}
                    onChange={(e) => setNewEndsAt(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={handleCreateProposal}
                  disabled={createProposalMutation.isPending}
                >
                  {createProposalMutation.isPending ? "Submitting…" : "Submit Proposal"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
              {!walletAddress && (
                <p className="text-xs text-muted-foreground text-center">Connect your wallet to submit a proposal</p>
              )}
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed">
            Loading proposals…
          </div>
        ) : !proposals.length ? (
          <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed bg-card">
            No governance proposals yet. Be the first to submit one.
          </div>
        ) : (
          <div className="space-y-3">
            {proposals.map((proposal) => {
              const totalVotes = proposal.votesFor + proposal.votesAgainst;
              const forPct = totalVotes > 0 ? Math.round((proposal.votesFor / totalVotes) * 100) : 0;
              const againstPct = totalVotes > 0 ? 100 - forPct : 0;
              return (
                <Card key={proposal.id}>
                  <CardHeader className="pb-2 p-4">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
                      <CardTitle className="text-sm sm:text-base leading-snug">
                        {proposal.title}
                      </CardTitle>
                      <span className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-wider font-bold shrink-0 self-start ${
                        proposal.status === "active" ? "bg-green-500/10 text-green-600"
                        : proposal.status === "passed" ? "bg-blue-500/10 text-blue-600"
                        : "bg-muted text-muted-foreground"
                      }`}>
                        {proposal.status}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {proposal.description}
                    </p>

                    {totalVotes > 0 && (
                      <div className="space-y-1">
                        <div className="flex h-2 rounded overflow-hidden bg-secondary">
                          <div className="bg-primary transition-all" style={{ width: `${forPct}%` }} />
                          <div className="bg-destructive/50 transition-all" style={{ width: `${againstPct}%` }} />
                        </div>
                        <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                          <span className="text-primary">For: {proposal.votesFor} ({forPct}%)</span>
                          <span className="text-destructive/70">Against: {proposal.votesAgainst} ({againstPct}%)</span>
                        </div>
                      </div>
                    )}

                    {totalVotes === 0 && (
                      <div className="text-xs text-muted-foreground font-mono">No votes yet</div>
                    )}

                    {proposal.status === "active" && (
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          className="flex-1 sm:flex-none bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border border-primary/30"
                          variant="outline"
                          disabled={castVoteMutation.isPending}
                          onClick={() => handleVote(proposal.id, "for")}
                        >
                          👍 Vote For
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 sm:flex-none"
                          disabled={castVoteMutation.isPending}
                          onClick={() => handleVote(proposal.id, "against")}
                        >
                          👎 Vote Against
                        </Button>
                        {proposal.endsAt && (
                          <span className="text-[10px] text-muted-foreground self-center ml-auto">
                            Ends {new Date(proposal.endsAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Liquidity Pools section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
          <h2 className="text-lg sm:text-xl font-bold">Liquidity Pools</h2>
          {!walletAddress && (
            <p className="text-xs text-muted-foreground">Connect wallet to deposit / withdraw</p>
          )}
        </div>
        {poolsLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed">
            Loading liquidity pools…
          </div>
        ) : !pools.length ? (
          <div className="text-sm text-muted-foreground py-8 text-center border rounded border-dashed bg-card">
            No liquidity pools available yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {pools.map((pool) => {
              const myPosition = positionByPool.get(pool.id);
              const isDepLoading = depositLoading[pool.id] ?? false;
              const isWthLoading = withdrawLoading[pool.id] ?? false;
              return (
                <Card key={pool.id}>
                  <CardHeader className="pb-2 p-4">
                    <CardTitle className="text-xs sm:text-sm uppercase tracking-wider">
                      {pool.marketType.replace(/_/g, " ")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-3">
                    {/* Pool stats */}
                    <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                      <div className="bg-secondary rounded p-2 text-center">
                        <div className="text-[10px] text-muted-foreground uppercase mb-1">Liquidity</div>
                        <div className="font-bold">{formatLamports(pool.totalLiquidityLamports)}</div>
                      </div>
                      <div className="bg-secondary rounded p-2 text-center">
                        <div className="text-[10px] text-muted-foreground uppercase mb-1">APR</div>
                        <div className="font-bold text-primary">{(pool.aprBps / 100).toFixed(1)}%</div>
                      </div>
                      <div className="bg-secondary rounded p-2 text-center">
                        <div className="text-[10px] text-muted-foreground uppercase mb-1">LPs</div>
                        <div className="font-bold">{pool.providerCount}</div>
                      </div>
                    </div>

                    {/* My position in this pool */}
                    {myPosition && (
                      <div className="bg-primary/5 border border-primary/20 rounded p-2 text-xs space-y-0.5">
                        <div className="font-semibold text-primary text-[10px] uppercase tracking-wider mb-1">My Position</div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Principal</span>
                          <span className="font-mono font-bold">{formatLamports(myPosition.depositedLamports)} SOL</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Accrued Yield</span>
                          <span className="font-mono font-bold text-green-600">+{formatLamports(myPosition.accruedYieldLamports)} SOL</span>
                        </div>
                      </div>
                    )}

                    {/* Deposit */}
                    {walletAddress && (
                      <div className="space-y-2">
                        <div className="flex gap-1.5">
                          <Input
                            type="number"
                            step="0.1"
                            min="0.01"
                            placeholder="SOL amount"
                            className="text-xs h-8 font-mono flex-1"
                            value={depositAmounts[pool.id] ?? ""}
                            onChange={(e) =>
                              setDepositAmounts((prev) => ({ ...prev, [pool.id]: e.target.value }))
                            }
                          />
                          <Button
                            size="sm"
                            className="h-8 text-xs shrink-0"
                            disabled={isDepLoading}
                            onClick={() => handleDeposit(pool.id)}
                          >
                            {isDepLoading ? "…" : "Deposit"}
                          </Button>
                        </div>

                        {/* Withdraw — only if position exists */}
                        {myPosition && (
                          <div className="flex gap-1.5">
                            <Input
                              type="number"
                              step="0.1"
                              min="0.01"
                              placeholder="SOL to withdraw"
                              className="text-xs h-8 font-mono flex-1"
                              value={withdrawAmounts[pool.id] ?? ""}
                              onChange={(e) =>
                                setWithdrawAmounts((prev) => ({ ...prev, [pool.id]: e.target.value }))
                              }
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs shrink-0"
                              disabled={isWthLoading}
                              onClick={() => handleWithdraw(pool.id, false)}
                            >
                              {isWthLoading ? "…" : "Withdraw"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs shrink-0 text-destructive hover:text-destructive"
                              disabled={isWthLoading}
                              onClick={() => handleWithdraw(pool.id, true)}
                            >
                              All
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
