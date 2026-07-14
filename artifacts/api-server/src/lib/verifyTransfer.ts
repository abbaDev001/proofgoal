/**
 * Shared on-chain Solana transfer verification helper.
 * Used by both positions.ts and insurance.ts.
 */

export const SOLANA_RPC =
  process.env["TXLINE_NETWORK"] === "devnet"
    ? "https://api.devnet.solana.com"
    : "https://api.mainnet-beta.solana.com";

interface SolanaTransaction {
  transaction: {
    message: {
      accountKeys?: string[];
      staticAccountKeys?: string[];
    };
  };
  meta?: {
    preBalances?: number[];
    postBalances?: number[];
    err?: unknown;
  };
}

/**
 * Verifies that `txSignature` represents a confirmed SOL transfer of at least
 * `minLamports` from `fromAddress` to `toAddress`.
 * Throws a descriptive Error if verification fails.
 */
export async function verifySolanaTransfer(
  txSignature: string,
  fromAddress: string,
  toAddress: string,
  minLamports: number,
): Promise<void> {
  const resp = await fetch(SOLANA_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTransaction",
      params: [
        txSignature,
        { encoding: "json", commitment: "confirmed", maxSupportedTransactionVersion: 0 },
      ],
    }),
  });

  if (!resp.ok) throw new Error(`Solana RPC unavailable (${resp.status})`);

  const body = (await resp.json()) as {
    result?: SolanaTransaction;
    error?: { message: string };
  };

  if (body.error) throw new Error(`RPC error: ${body.error.message}`);
  if (!body.result) throw new Error("Transaction not found on-chain");

  const tx = body.result;
  if (tx.meta?.err) throw new Error("Transaction reverted on-chain");

  const accountKeys: string[] =
    tx.transaction.message.accountKeys ??
    tx.transaction.message.staticAccountKeys ??
    [];

  const fromIdx = accountKeys.indexOf(fromAddress);
  const toIdx = accountKeys.indexOf(toAddress);

  if (fromIdx === -1) throw new Error("Sender address not found in transaction");
  if (toIdx === -1) throw new Error("Treasury address not found in transaction");

  const pre = tx.meta?.preBalances ?? [];
  const post = tx.meta?.postBalances ?? [];
  const received = (post[toIdx] ?? 0) - (pre[toIdx] ?? 0);

  if (received < minLamports) {
    throw new Error(
      `Insufficient transfer: treasury received ${received} lamports, need ${minLamports}`,
    );
  }
}
