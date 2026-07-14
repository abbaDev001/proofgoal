import { useMemo } from "react";
import { Switch, Route } from "wouter";
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { clusterApiUrl } from "@solana/web3.js";
import { Layout } from "@/components/layout";
import { HomePage } from "@/pages/home";
import { ConnectWalletPage } from "@/pages/connect";
import { MarketsPage } from "@/pages/markets";
import { MarketDetailPage } from "@/pages/market-detail";
import { MatchesPage } from "@/pages/matches";
import { MatchDetailPage } from "@/pages/match-detail";
import { InsurancePage } from "@/pages/insurance";
import { ProofsPage } from "@/pages/proofs";
import { PortfolioPage } from "@/pages/portfolio";
import { GovernancePage } from "@/pages/governance";
import { AdminPage } from "@/pages/admin";
import { WalletRegistrationProvider } from "@/lib/wallet";
import NotFound from "@/pages/not-found";

export default function App() {
  // Use devnet to match our activated TxLINE subscription
  const endpoint = useMemo(() => clusterApiUrl("devnet"), []);
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <WalletRegistrationProvider>
            <Layout>
              <Switch>
                <Route path="/" component={HomePage} />
                <Route path="/connect" component={ConnectWalletPage} />
                <Route path="/markets" component={MarketsPage} />
                <Route path="/markets/:marketId" component={MarketDetailPage} />
                <Route path="/matches" component={MatchesPage} />
                <Route path="/matches/:matchId" component={MatchDetailPage} />
                <Route path="/insurance" component={InsurancePage} />
                <Route path="/proofs" component={ProofsPage} />
                <Route path="/portfolio" component={PortfolioPage} />
                <Route path="/governance" component={GovernancePage} />
                <Route path="/admin" component={AdminPage} />
                <Route component={NotFound} />
              </Switch>
            </Layout>
          </WalletRegistrationProvider>
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
