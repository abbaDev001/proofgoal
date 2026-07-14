import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useConnectWallet } from "@workspace/api-client-react";

interface WalletRegistrationContextState {
  walletAddress: string | null;
  isRegistering: boolean;
  registrationError: string | null;
}

const WalletRegistrationContext = createContext<
  WalletRegistrationContextState | undefined
>(undefined);

export function WalletRegistrationProvider({ children }: { children: ReactNode }) {
  const { publicKey, connected, disconnecting } = useWallet();
  const connectWalletMutation = useConnectWallet();
  const [walletAddress, setWalletAddress] = useState<string | null>(() => {
    return localStorage.getItem("proofgoal_wallet") || null;
  });
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const lastRegisteredRef = useRef<string | null>(null);

  useEffect(() => {
    if (!connected || !publicKey) {
      if (disconnecting || !connected) {
        setWalletAddress(null);
        localStorage.removeItem("proofgoal_wallet");
        lastRegisteredRef.current = null;
        setRegistrationError(null);
      }
      return;
    }

    const address = publicKey.toBase58();
    if (lastRegisteredRef.current === address) return;

    setIsRegistering(true);
    setRegistrationError(null);

    connectWalletMutation
      .mutateAsync({ data: { walletAddress: address } })
      .then((user) => {
        setWalletAddress(user.walletAddress);
        localStorage.setItem("proofgoal_wallet", user.walletAddress);
        lastRegisteredRef.current = address;
      })
      .catch(() => {
        setRegistrationError("Failed to register with backend");
        setWalletAddress(address);
        localStorage.setItem("proofgoal_wallet", address);
        lastRegisteredRef.current = address;
      })
      .finally(() => setIsRegistering(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, publicKey, disconnecting]);

  return (
    <WalletRegistrationContext.Provider
      value={{ walletAddress, isRegistering, registrationError }}
    >
      {children}
    </WalletRegistrationContext.Provider>
  );
}

function useWalletRegistration() {
  const ctx = useContext(WalletRegistrationContext);
  if (!ctx)
    throw new Error(
      "useWalletRegistration must be used within WalletRegistrationProvider",
    );
  return ctx;
}

export function useAppWallet() {
  const { walletAddress, isRegistering, registrationError } = useWalletRegistration();
  const solana = useWallet();
  return {
    walletAddress,
    isRegistering,
    registrationError,
    connected: solana.connected,
    connecting: solana.connecting,
    disconnect: solana.disconnect,
    publicKey: solana.publicKey,
    wallet: solana.wallet,
    select: solana.select,
    connect: solana.connect,
  };
}

/** Returns the connected wallet's SOL balance (in SOL, not lamports), polling every 30s. */
export function useSolBalance(): number | null {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);

  // Use a stable key so the effect only re-runs when the key actually changes
  const pubkeyStr = publicKey?.toBase58() ?? null;

  useEffect(() => {
    if (!publicKey || !pubkeyStr) {
      setBalance(null);
      return;
    }
    let cancelled = false;

    const fetchBalance = async () => {
      try {
        const lamports = await connection.getBalance(publicKey);
        if (!cancelled) setBalance(lamports / LAMPORTS_PER_SOL);
      } catch {
        // Network hiccups are common on devnet — silently retry next interval
      }
    };

    void fetchBalance();
    const interval = setInterval(fetchBalance, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubkeyStr]);

  return balance;
}
