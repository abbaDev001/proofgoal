import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useAppWallet } from "@/lib/wallet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { shortenAddress } from "@/lib/format";

function PhantomIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="128" height="128" rx="32" fill="#AB9FF2"/>
      <path d="M110.584 64.291C110.584 88.291 91.074 107.8 67.075 107.8H55.427C51.427 107.8 47.719 105.475 45.862 101.8L22.862 57.8C21.427 55.008 21.427 51.692 22.862 48.9C24.296 46.108 27.008 44.3 30 44.3H38.5C44.3 44.3 49 49 49 54.8V64.3C49 70.1 44.3 74.8 38.5 74.8H36.5C35.5 74.8 34.8 75.9 35.3 76.8L42.8 91C43.2 91.8 44.1 92.3 45 92.3H67C79.7 92.3 90 82 90 69.3C90 56.6 79.7 46.3 67 46.3H64.5C63.1 46.3 62 47.4 62 48.8V55.8C62 57.2 63.1 58.3 64.5 58.3H67C73 58.3 77.9 63.2 77.9 69.3C77.9 75.4 73 80.3 67 80.3H60.7C59.3 80.3 58.2 79.2 58.2 77.8V54.8C58.2 40 70 28.3 84.8 28.3C99.6 28.3 110.584 44.5 110.584 64.291Z" fill="white"/>
    </svg>
  );
}

function SolflareIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="128" height="128" rx="32" fill="#FC7227"/>
      <path d="M64 20L107 98H21L64 20Z" fill="white" opacity="0.9"/>
      <path d="M64 40L95 98H33L64 40Z" fill="#FC7227"/>
      <path d="M64 60L82 98H46L64 60Z" fill="white" opacity="0.6"/>
    </svg>
  );
}

export function ConnectWalletPage() {
  const { select, wallets, wallet, connect, connecting, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { walletAddress, isRegistering, registrationError } = useAppWallet();
  const [, setLocation] = useLocation();

  // After a wallet is selected, automatically trigger the connection popup.
  // This fires only when the selected wallet adapter changes (not on every render).
  const prevWalletNameRef = useRef<string | null>(null);
  const connectRef = useRef(connect);
  useEffect(() => { connectRef.current = connect; }, [connect]);

  useEffect(() => {
    const name = wallet?.adapter.name ?? null;
    if (name && name !== prevWalletNameRef.current && !connected && !connecting) {
      prevWalletNameRef.current = name;
      connectRef.current().catch(() => {});
    }
    if (!name) prevWalletNameRef.current = null;
  }, [wallet?.adapter.name, connected, connecting]);

  useEffect(() => {
    if (walletAddress) {
      setLocation("/");
    }
  }, [walletAddress, setLocation]);

  const phantom = wallets.find((w) => w.adapter.name === "Phantom");
  const solflare = wallets.find((w) => w.adapter.name === "Solflare");

  const handleSelectWallet = (walletName: string) => {
    select(walletName as never);
  };

  return (
    <div className="max-w-lg mx-auto mt-12 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Connect Wallet</h1>
        <p className="text-muted-foreground">
          Use your Solana wallet to trade prediction markets and purchase insurance.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Browser Extension</CardTitle>
          <CardDescription>
            Connect with a Solana wallet extension installed in your browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {phantom ? (
            <Button
              className="w-full h-14 text-base justify-start gap-4"
              variant={phantom.readyState === "Installed" ? "default" : "outline"}
              onClick={() => handleSelectWallet("Phantom")}
              disabled={isRegistering || connecting}
            >
              <PhantomIcon />
              <div className="flex flex-col items-start">
                <span className="font-bold">Phantom</span>
                <span className="text-xs opacity-70">
                  {phantom.readyState === "Installed" ? "Installed" : "Not installed — click to install"}
                </span>
              </div>
            </Button>
          ) : (
            <a href="https://phantom.app/" target="_blank" rel="noopener noreferrer">
              <Button className="w-full h-14 text-base justify-start gap-4" variant="outline">
                <PhantomIcon />
                <div className="flex flex-col items-start">
                  <span className="font-bold">Phantom</span>
                  <span className="text-xs opacity-70">Install extension</span>
                </div>
              </Button>
            </a>
          )}

          {solflare ? (
            <Button
              className="w-full h-14 text-base justify-start gap-4"
              variant={solflare.readyState === "Installed" ? "default" : "outline"}
              onClick={() => handleSelectWallet("Solflare")}
              disabled={isRegistering || connecting}
            >
              <SolflareIcon />
              <div className="flex flex-col items-start">
                <span className="font-bold">Solflare</span>
                <span className="text-xs opacity-70">
                  {solflare.readyState === "Installed" ? "Installed" : "Not installed — click to install"}
                </span>
              </div>
            </Button>
          ) : (
            <a href="https://solflare.com/" target="_blank" rel="noopener noreferrer">
              <Button className="w-full h-14 text-base justify-start gap-4" variant="outline">
                <SolflareIcon />
                <div className="flex flex-col items-start">
                  <span className="font-bold">Solflare</span>
                  <span className="text-xs opacity-70">Install extension</span>
                </div>
              </Button>
            </a>
          )}

          <Button
            className="w-full"
            variant="ghost"
            onClick={() => setVisible(true)}
            disabled={isRegistering || connecting}
          >
            More wallets...
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Mobile</CardTitle>
          <CardDescription>
            Scan a QR code with your Phantom or Solflare mobile app to connect.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full h-14 text-base"
            variant="outline"
            onClick={() => setVisible(true)}
          >
            Connect Mobile Wallet
          </Button>
        </CardContent>
      </Card>

      {(isRegistering || connecting) && (
        <Alert>
          <AlertDescription className="text-center">
            {connecting ? "Opening wallet…" : "Registering wallet with ProofGoal…"}
          </AlertDescription>
        </Alert>
      )}

      {registrationError && (
        <Alert variant="destructive">
          <AlertDescription>{registrationError}</AlertDescription>
        </Alert>
      )}

      {walletAddress && (
        <Alert>
          <AlertDescription className="font-mono text-center">
            Connected: {shortenAddress(walletAddress)}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
