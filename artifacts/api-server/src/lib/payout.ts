/**
 * Treasury payout helper.
 *
 * Sends SOL from the treasury wallet to a winner's wallet using @solana/web3.js.
 * The treasury keypair is loaded from TREASURY_WALLET_PRIVATE_KEY (base-64 encoded
 * 64-byte secret key).
 */
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { logger } from "./logger";

const SOLANA_RPC =
  process.env["TXLINE_NETWORK"] === "devnet"
    ? "https://api.devnet.solana.com"
    : "https://api.mainnet-beta.solana.com";

/** Load treasury keypair from env. Throws if not configured.
 *  Accepts hex (128 chars) or base64 (88 chars) — auto-detected. */
function loadTreasuryKeypair(): Keypair {
  const raw = process.env["TREASURY_WALLET_PRIVATE_KEY"];
  if (!raw) throw new Error("TREASURY_WALLET_PRIVATE_KEY is not set");
  const trimmed = raw.trim();
  // Detect encoding by length: hex is 128 chars, base64 is 88 chars
  const secretKey =
    trimmed.length === 128
      ? Uint8Array.from(Buffer.from(trimmed, "hex"))
      : Uint8Array.from(Buffer.from(trimmed, "base64"));
  if (secretKey.length !== 64) {
    throw new Error(`Invalid key size: expected 64 bytes, got ${secretKey.length}. Check TREASURY_WALLET_PRIVATE_KEY.`);
  }
  return Keypair.fromSecretKey(secretKey);
}

/**
 * Sends `lamports` of SOL from the treasury to `toAddress`.
 * Returns the confirmed transaction signature.
 * Throws on any failure so the caller can decide whether to retry or surface an error.
 */
export async function sendPayout(toAddress: string, lamports: number): Promise<string> {
  if (lamports <= 0) throw new Error(`Invalid payout amount: ${lamports}`);

  const treasury = loadTreasuryKeypair();
  const connection = new Connection(SOLANA_RPC, "confirmed");

  // Check treasury balance before sending
  const balance = await connection.getBalance(treasury.publicKey);
  // Leave ~0.001 SOL (1_000_000 lamports) as rent/fee reserve
  const reserve = 1_000_000;
  if (balance < lamports + reserve) {
    throw new Error(
      `Treasury insufficient balance: has ${balance} lamports, need ${lamports + reserve}`,
    );
  }

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: treasury.publicKey,
      toPubkey: new PublicKey(toAddress),
      lamports,
    }),
  );

  const sig = await sendAndConfirmTransaction(connection, tx, [treasury], {
    commitment: "confirmed",
  });

  logger.info({ toAddress, lamports, sig, treasury: treasury.publicKey.toBase58() }, "Payout sent");
  return sig;
}

/** Convenience: returns `true` if the treasury keypair is configured. */
export function isTreasuryConfigured(): boolean {
  return Boolean(process.env["TREASURY_WALLET_PRIVATE_KEY"]);
}
