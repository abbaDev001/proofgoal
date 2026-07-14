import { useState } from "react";
import { useParams } from "wouter";
import {
  useGetMarket,
  useCreatePosition,
  getGetMarketQueryKey,
} from "@workspace/api-client-react";
import { useAppWallet } from "@/lib/wallet";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatLamports, formatOdds } from "@/lib/format";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface AppConfig {
  treasuryWallet: string | null;
  network: string;
}

export function MarketDetailPage() {
  const { marketId } = useParams();
  const { walletAddress } = useAppWallet();
  const { sendTransaction, publicKey: userPublicKey } = useWallet();
  const { connection } = useConnection();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: market, isLoading } = useGetMarket(marketId!, {
    query: { enabled: !!marketId, queryKey: getGetMarketQueryKey(marketId!) },
  });

  // Fetch treasury config for on-chain transfers
  const { data: appConfig } = useQuery<AppConfig>({
    queryKey: ["app-config"],
    queryFn: () => fetch("/api/config").then((r) => r.json() as Promise<AppConfig>),
    staleTime: Infinity,
  });

  const placePosition = useCreatePosition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stake, setStake] = useState("1");
  const [isSendingTx, setIsSendingTx] = useState(false);

  const handleTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletAddress) {
      toast({ title: "Wallet not connected", description: "Connect wallet to trade.", variant: "destructive" });
      return;
    }
    if (!selectedId) {
      toast({ title: "Selection required", description: "Choose an outcome.", variant: "destructive" });
      return;
    }
    const stakeSol = parseFloat(stake);
    if (isNaN(stakeSol) || stakeSol <= 0) {
      toast({ title: "Invalid stake", description: "Enter a valid SOL amount greater than 0.", variant: "destructive" });
      return;
    }
    const stakeLamports = Math.round(stakeSol * LAMPORTS_PER_SOL);

    let txSignature: string | undefined;

    // If a treasury wallet is configured and we have a connected wallet, send real SOL
    if (appConfig?.treasuryWallet && userPublicKey) {
      try {
        setIsSendingTx(true);
        toast({ title: "Sending SOL…", description: "Approve the transaction in your wallet." });

        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: userPublicKey,
            toPubkey: new PublicKey(appConfig.treasuryWallet),
            lamports: stakeLamports,
          }),
        );
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = userPublicKey;

        txSignature = await sendTransaction(tx, connection);
        await connection.confirmTransaction({ signature: txSignature, blockhash, lastValidBlockHeight }, "confirmed");
        toast({ title: "Payment confirmed ✓", description: `${stakeSol} SOL transferred on-chain.` });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Transaction rejected";
        toast({ title: "Transaction failed", description: msg, variant: "destructive" });
        return;
      } finally {
        setIsSendingTx(false);
      }
    }

    try {
      await placePosition.mutateAsync({
        data: {
          walletAddress,
          marketId: marketId!,
          selectionId: selectedId,
          stakeLamports,
          // txSignature is not in the generated CreatePositionBody type, but the server
          // accepts it via an extended Zod schema and verifies it on-chain.
          ...(txSignature ? { txSignature } : {}),
        } as Parameters<typeof placePosition.mutateAsync>[0]["data"],
      });
      toast({
        title: "Trade placed",
        description: txSignature ? "On-chain position opened." : "Simulated position opened.",
      });
      queryClient.invalidateQueries({ queryKey: getGetMarketQueryKey(marketId!) });
    } catch {
      toast({ title: "Trade failed", description: "Could not place position.", variant: "destructive" });
    }
  };

  if (isLoading) return <div className="text-center py-10">Loading market…</div>;
  if (!market) return <div className="text-center py-10">Market not found.</div>;

  const selectedSelection = market.selections.find((s) => s.id === selectedId);
  const isOnChain = Boolean(appConfig?.treasuryWallet && userPublicKey);

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight mb-2">{market.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-muted-foreground">
          <span className="uppercase px-2 py-1 rounded bg-secondary">{market.status}</span>
          <span className="uppercase">{market.type.replace(/_/g, " ")}</span>
          <span>Liq: {formatLamports(market.liquidityLamports)} SOL</span>
          {isOnChain ? (
            <Badge variant="default" className="text-[10px]">On-chain</Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">Simulated</Badge>
          )}
        </div>
      </div>

      {/* On mobile: trade panel comes first; on desktop: it's in the right col */}
      <div className="flex flex-col md:hidden">
        <TradePanel
          market={market}
          selectedSelection={selectedSelection}
          stake={stake}
          setStake={setStake}
          walletAddress={walletAddress}
          isOnChain={isOnChain}
          isPending={placePosition.isPending || isSendingTx}
          handleTrade={handleTrade}
        />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Selections */}
        <div className="md:col-span-2 space-y-4">
          <h2 className="text-lg sm:text-xl font-semibold">Selections</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {market.selections.map((sel) => (
              <Card
                key={sel.id}
                className={`cursor-pointer transition-colors ${
                  selectedId === sel.id
                    ? "border-primary ring-1 ring-primary"
                    : "hover:border-primary/50"
                }`}
                onClick={() => setSelectedId(sel.id)}
              >
                <CardContent className="p-4 flex justify-between items-center gap-3">
                  <span className="font-medium text-sm">{sel.label}</span>
                  <span className="text-lg font-bold font-mono shrink-0">{formatOdds(sel.odds)}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Trade panel — desktop only (hidden on mobile, shown above) */}
        <div className="hidden md:block">
          <TradePanel
            market={market}
            selectedSelection={selectedSelection}
            stake={stake}
            setStake={setStake}
            walletAddress={walletAddress}
            isOnChain={isOnChain}
            isPending={placePosition.isPending || isSendingTx}
            handleTrade={handleTrade}
          />
        </div>
      </div>
    </div>
  );
}

function TradePanel({
  market,
  selectedSelection,
  stake,
  setStake,
  walletAddress,
  isOnChain,
  isPending,
  handleTrade,
}: {
  market: { status: string; selections: { id: string; label: string; odds: number }[] };
  selectedSelection?: { label: string; odds: number };
  stake: string;
  setStake: (v: string) => void;
  walletAddress: string | null;
  isOnChain: boolean;
  isPending: boolean;
  handleTrade: (e: React.FormEvent) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          Place Trade
          {isOnChain ? (
            <Badge variant="default" className="text-[10px]">Real SOL</Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">Simulated</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleTrade} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Selected Outcome</Label>
            <div className="text-sm p-2.5 bg-secondary rounded border font-medium min-h-[38px] flex items-center justify-between">
              <span>{selectedSelection ? selectedSelection.label : "Choose a selection above"}</span>
              {selectedSelection && (
                <span className="font-mono text-primary">{formatOdds(selectedSelection.odds)}</span>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stake" className="text-xs">Stake (SOL)</Label>
            <Input
              id="stake"
              type="number"
              step="0.1"
              min="0.1"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="font-mono"
            />
          </div>
          <div className="pt-2 border-t flex justify-between items-center text-sm font-medium">
            <span className="text-muted-foreground">Est. Payout</span>
            <span className="font-mono text-primary font-bold">
              {selectedSelection && parseFloat(stake) > 0
                ? (parseFloat(stake) * selectedSelection.odds).toFixed(4)
                : "0.0000"}{" "}
              SOL
            </span>
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={!selectedSelection || isPending || market.status !== "open"}
          >
            {isPending
              ? isOnChain ? "Confirming on-chain…" : "Placing…"
              : market.status !== "open"
                ? "Market Closed"
                : isOnChain
                  ? "Place Trade (Real SOL)"
                  : "Place Trade"}
          </Button>
          {!walletAddress && (
            <p className="text-xs text-center text-muted-foreground">Connect wallet to trade</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
