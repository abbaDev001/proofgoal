import { Link, useLocation } from "wouter";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useAppWallet, useSolBalance } from "@/lib/wallet";
import { shortenAddress } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import {
  LayoutDashboard,
  TrendingUp,
  Trophy,
  Shield,
  Briefcase,
  FileCheck,
  Scale,
  Settings2,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/markets", label: "Markets", icon: TrendingUp },
  { href: "/matches", label: "Matches", icon: Trophy },
  { href: "/insurance", label: "Insurance", icon: Shield },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase },
  { href: "/proofs", label: "Proofs", icon: FileCheck },
  { href: "/governance", label: "Governance", icon: Scale },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { walletAddress, disconnect, connecting, isRegistering } = useAppWallet();
  const { setVisible } = useWalletModal();
  const [location] = useLocation();
  const solBalance = useSolBalance();

  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      {/* Top header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-6">
            <Link href="/" className="font-bold text-lg tracking-tight text-primary shrink-0">
              ProofGoal
            </Link>
            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 text-sm font-medium transition-colors hover:text-primary ${
                    location === item.href ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/admin"
                className={`px-2 py-2 text-sm font-medium transition-colors hover:text-primary ${
                  location === "/admin" ? "text-primary" : "text-muted-foreground"
                }`}
                title="Admin"
              >
                <Settings2 size={16} />
              </Link>
            </nav>
          </div>

          {/* Wallet area */}
          <div className="flex items-center gap-2">
            {walletAddress ? (
              <>
                {/* Badge: green dot + address + SOL balance */}
                <div className="flex items-center gap-1.5 bg-secondary px-2 py-1 rounded-lg border">
                  <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                  <span className="text-xs font-mono hidden sm:inline">
                    {shortenAddress(walletAddress)}
                  </span>
                  <span className="text-xs font-mono sm:hidden">
                    {walletAddress.slice(0, 4)}…
                  </span>
                  {solBalance !== null && (
                    <span className="text-xs font-mono text-muted-foreground hidden sm:inline border-l pl-1.5 ml-0.5">
                      {solBalance.toFixed(3)} SOL
                    </span>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={disconnect} className="text-xs px-2 h-7">
                  Disconnect
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => setVisible(true)}
                disabled={connecting || isRegistering}
                className="text-xs px-3 h-8"
              >
                {connecting || isRegistering ? "Connecting…" : "Connect Wallet"}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main content — extra bottom padding on mobile for the bottom nav */}
      <main className="flex-1 container mx-auto px-4 py-4 sm:py-8 pb-24 md:pb-8">
        {children}
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t">
        <div className="grid grid-cols-7 h-14">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon
                  size={18}
                  className={active ? "text-primary" : "text-muted-foreground"}
                  strokeWidth={active ? 2.5 : 1.75}
                />
                <span className="text-[9px] font-medium leading-none">
                  {item.label === "Dashboard" ? "Home" : item.label === "Governance" ? "Gov" : item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <Toaster />
    </div>
  );
}
