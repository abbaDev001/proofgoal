import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, liquidityPoolsTable, liquidityPositionsTable } from "@workspace/db";
import { ListLiquidityPoolsResponse } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { sendPayout, isTreasuryConfigured } from "../lib/payout";
import { accrueYield } from "../lib/liquidity";

const router: IRouter = Router();

// ── Solana transaction verification (mirrored from positions.ts) ──────────────
const SOLANA_RPC =
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

async function verifySolanaTransfer(
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

// ── GET /liquidity/pools ──────────────────────────────────────────────────────

router.get("/liquidity/pools", async (_req, res): Promise<void> => {
  const pools = await db.select().from(liquidityPoolsTable);
  res.json(ListLiquidityPoolsResponse.parse(pools));
});

// ── POST /liquidity/pools/:poolId/deposit ─────────────────────────────────────

router.post("/liquidity/pools/:poolId/deposit", async (req, res): Promise<void> => {
  const poolId = req.params.poolId as string;
  const walletAddress = req.body?.walletAddress as string | undefined;
  const lamports = req.body?.lamports as number | undefined;
  const txSignature = req.body?.txSignature as string | undefined;

  if (!poolId || !walletAddress || !lamports || lamports <= 0) {
    res.status(400).json({ error: "poolId, walletAddress, and lamports (> 0) are required" });
    return;
  }

  const [pool] = await db
    .select()
    .from(liquidityPoolsTable)
    .where(eq(liquidityPoolsTable.id, poolId));

  if (!pool) {
    res.status(404).json({ error: "Liquidity pool not found" });
    return;
  }

  const treasuryWallet = process.env["TREASURY_WALLET_PUBKEY"];
  if (txSignature && treasuryWallet) {
    const [reused] = await db
      .select()
      .from(liquidityPositionsTable)
      .where(eq(liquidityPositionsTable.lastDepositTxSig, txSignature));
    if (reused) {
      res.status(400).json({ error: "This transaction signature has already been used" });
      return;
    }
    try {
      await verifySolanaTransfer(txSignature, walletAddress, treasuryWallet, lamports);
    } catch (err) {
      logger.warn({ err, txSignature }, "LP deposit on-chain tx verification failed");
      res.status(400).json({
        error: `Transaction verification failed: ${(err as Error).message}`,
      });
      return;
    }
  }

  // Check if this wallet already has a position in this pool
  const [existing] = await db
    .select()
    .from(liquidityPositionsTable)
    .where(
      and(
        eq(liquidityPositionsTable.poolId, poolId),
        eq(liquidityPositionsTable.walletAddress, walletAddress),
      ),
    );

  let position;
  let isNewPosition = false;

  if (existing) {
    // Accrue yield on existing position before adding to it
    const accrued = await accrueYield(existing, pool);

    const [updated] = await db
      .update(liquidityPositionsTable)
      .set({
        depositedLamports: accrued.depositedLamports + lamports,
        depositedAt: new Date(),
        lastDepositTxSig: txSignature ?? existing.lastDepositTxSig ?? null,
      })
      .where(eq(liquidityPositionsTable.id, existing.id))
      .returning();
    position = updated;
  } else {
    // New position
    isNewPosition = true;
    const [created] = await db
      .insert(liquidityPositionsTable)
      .values({
        poolId,
        walletAddress,
        depositedLamports: lamports,
        accruedYieldLamports: 0,
        lastDepositTxSig: txSignature ?? null,
      })
      .returning();
    position = created;
  }

  // Update pool totals
  await db
    .update(liquidityPoolsTable)
    .set({
      totalLiquidityLamports: pool.totalLiquidityLamports + lamports,
      providerCount: isNewPosition ? pool.providerCount + 1 : pool.providerCount,
    })
    .where(eq(liquidityPoolsTable.id, poolId));

  logger.info({ poolId, walletAddress, lamports, isNewPosition }, "LP deposit recorded");
  res.status(201).json(position);
});

// ── POST /liquidity/pools/:poolId/withdraw ────────────────────────────────────

router.post("/liquidity/pools/:poolId/withdraw", async (req, res): Promise<void> => {
  const poolId = req.params.poolId as string;
  const walletAddress = req.body?.walletAddress as string | undefined;
  // amountLamports is optional; omit or set to 0/"all" for full withdrawal
  const rawAmount = req.body?.amountLamports;

  if (!poolId || !walletAddress) {
    res.status(400).json({ error: "poolId and walletAddress are required" });
    return;
  }

  if (!isTreasuryConfigured()) {
    res.status(503).json({ error: "Treasury payout is not configured on this server." });
    return;
  }

  const [pool] = await db
    .select()
    .from(liquidityPoolsTable)
    .where(eq(liquidityPoolsTable.id, poolId));

  if (!pool) {
    res.status(404).json({ error: "Liquidity pool not found" });
    return;
  }

  const [existing] = await db
    .select()
    .from(liquidityPositionsTable)
    .where(
      and(
        eq(liquidityPositionsTable.poolId, poolId),
        eq(liquidityPositionsTable.walletAddress, walletAddress),
      ),
    );

  if (!existing) {
    res.status(404).json({ error: "No liquidity position found for this wallet in this pool" });
    return;
  }

  // Accrue yield before withdrawal
  const position = await accrueYield(existing, pool);

  // Determine withdrawal amount
  const isFullWithdrawal =
    rawAmount === undefined ||
    rawAmount === null ||
    rawAmount === 0 ||
    rawAmount === "all";

  let principalToWithdraw: number;
  let yieldToWithdraw: number;

  if (isFullWithdrawal) {
    principalToWithdraw = position.depositedLamports;
    yieldToWithdraw = position.accruedYieldLamports;
  } else {
    const requestedPrincipal = Number(rawAmount);
    if (isNaN(requestedPrincipal) || requestedPrincipal <= 0) {
      res.status(400).json({ error: "amountLamports must be a positive number or omitted for full withdrawal" });
      return;
    }
    if (requestedPrincipal > position.depositedLamports) {
      res.status(400).json({
        error: `Insufficient principal: wallet has ${position.depositedLamports} lamports deposited, requested ${requestedPrincipal}`,
      });
      return;
    }
    principalToWithdraw = requestedPrincipal;
    // Proportional share of accrued yield
    const proportion = principalToWithdraw / position.depositedLamports;
    yieldToWithdraw = Math.floor(position.accruedYieldLamports * proportion);
  }

  const payoutLamports = principalToWithdraw + yieldToWithdraw;

  if (payoutLamports <= 0) {
    res.status(400).json({ error: "Nothing to withdraw" });
    return;
  }

  try {
    const payoutTxSig = await sendPayout(walletAddress, payoutLamports);

    const remainingPrincipal = position.depositedLamports - principalToWithdraw;
    const remainingYield = position.accruedYieldLamports - yieldToWithdraw;
    const isPositionClosed = remainingPrincipal <= 0;

    if (isPositionClosed) {
      await db
        .delete(liquidityPositionsTable)
        .where(eq(liquidityPositionsTable.id, position.id));

      await db
        .update(liquidityPoolsTable)
        .set({
          totalLiquidityLamports: Math.max(0, pool.totalLiquidityLamports - principalToWithdraw),
          providerCount: Math.max(0, pool.providerCount - 1),
        })
        .where(eq(liquidityPoolsTable.id, poolId));
    } else {
      await db
        .update(liquidityPositionsTable)
        .set({
          depositedLamports: remainingPrincipal,
          accruedYieldLamports: remainingYield,
        })
        .where(eq(liquidityPositionsTable.id, position.id));

      await db
        .update(liquidityPoolsTable)
        .set({
          totalLiquidityLamports: Math.max(0, pool.totalLiquidityLamports - principalToWithdraw),
        })
        .where(eq(liquidityPoolsTable.id, poolId));
    }

    logger.info(
      { poolId, walletAddress, principalToWithdraw, yieldToWithdraw, payoutTxSig, isPositionClosed },
      "LP withdrawal processed",
    );
    res.json({ success: true, payoutTxSig, payoutLamports });
  } catch (err) {
    logger.error({ err, poolId, walletAddress }, "LP withdrawal payout failed");
    res.status(502).json({ error: `Payout failed: ${(err as Error).message}` });
  }
});

// ── GET /liquidity/positions?walletAddress= ───────────────────────────────────

router.get("/liquidity/positions", async (req, res): Promise<void> => {
  const walletAddress = req.query["walletAddress"] as string | undefined;

  if (!walletAddress) {
    res.status(400).json({ error: "walletAddress query parameter is required" });
    return;
  }

  const positions = await db
    .select()
    .from(liquidityPositionsTable)
    .where(eq(liquidityPositionsTable.walletAddress, walletAddress));

  // Lazy yield accrual: fetch pools and accrue for each position
  const pools = await db.select().from(liquidityPoolsTable);
  const poolMap = new Map(pools.map((p) => [p.id, p]));

  const accrued = await Promise.all(
    positions.map(async (pos) => {
      const pool = poolMap.get(pos.poolId);
      if (!pool) return pos;
      const updated = await accrueYield(pos, pool);
      return {
        ...updated,
        pool: {
          marketType: pool.marketType,
          aprBps: pool.aprBps,
        },
      };
    }),
  );

  res.json(accrued);
});

export default router;
