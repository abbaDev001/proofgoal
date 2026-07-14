/**
 * Solana JSON-RPC helpers (no @solana/web3.js dependency for reads).
 */

const SOLANA_RPC =
  process.env["TXLINE_NETWORK"] === "devnet"
    ? "https://api.devnet.solana.com"
    : "https://api.mainnet-beta.solana.com";

const MIN_WEIGHT_SOL = 0.01;

/**
 * Fetch the SOL balance (in SOL, not lamports) for a given wallet address via JSON-RPC.
 * Returns MIN_WEIGHT_SOL as a floor so zero-balance wallets still get a non-zero weight.
 */
export async function getWalletBalanceSol(address: string): Promise<number> {
  const resp = await fetch(SOLANA_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [address, { commitment: "confirmed" }],
    }),
  });

  if (!resp.ok) {
    throw new Error(`Solana RPC getBalance failed: ${resp.status}`);
  }

  const data = (await resp.json()) as { result?: { value?: number }; error?: unknown };
  if (data.error) {
    throw new Error(`Solana RPC error: ${JSON.stringify(data.error)}`);
  }

  const lamports = data.result?.value ?? 0;
  const sol = lamports / 1_000_000_000;
  return Math.max(sol, MIN_WEIGHT_SOL);
}
