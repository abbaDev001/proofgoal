import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, insurancePoliciesTable, positionsTable } from "@workspace/db";
import {
  GetPortfolioSummaryParams,
  GetPortfolioSummaryResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/portfolio/:walletAddress", async (req, res): Promise<void> => {
  const params = GetPortfolioSummaryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const positions = await db
    .select()
    .from(positionsTable)
    .where(eq(positionsTable.walletAddress, params.data.walletAddress))
    .orderBy(positionsTable.placedAt);

  const policies = await db
    .select()
    .from(insurancePoliciesTable)
    .where(eq(insurancePoliciesTable.walletAddress, params.data.walletAddress))
    .orderBy(insurancePoliciesTable.purchasedAt);

  const totalStakedLamports = positions.reduce(
    (sum, p) => sum + p.stakeLamports,
    0,
  );
  const totalPremiumPaidLamports = policies.reduce(
    (sum, p) => sum + p.premiumPaidLamports,
    0,
  );
  const openPositions = positions.filter((p) => p.status === "pending").length;
  const activePolicies = policies.filter((p) => p.status === "active").length;

  res.json(
    GetPortfolioSummaryResponse.parse({
      walletAddress: params.data.walletAddress,
      totalStakedLamports,
      totalPremiumPaidLamports,
      openPositions,
      activePolicies,
      positions,
      policies,
    }),
  );
});

export default router;
