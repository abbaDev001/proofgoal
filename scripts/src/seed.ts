import {
  db,
  pool,
  insuranceProductsTable,
  liquidityPoolsTable,
  governanceProposalsTable,
} from "@workspace/db";

async function seed() {
  console.log("Seeding platform-defined content (no match data)...");

  const existingProducts = await db.select().from(insuranceProductsTable);
  if (existingProducts.length === 0) {
    await db.insert(insuranceProductsTable).values([
      {
        name: "Favorite Team Early Exit",
        type: "favorite_team_loss" as const,
        description: "Get paid out if your favorite team is eliminated before the quarter-finals.",
        premiumRateBps: 500,
        maxCoverageLamports: 10_000_000_000,
        triggerCondition: "team_eliminated_before_qf",
      },
      {
        name: "Tournament Exit Protection",
        type: "tournament_exit" as const,
        description: "Coverage against your selected team's group-stage elimination.",
        premiumRateBps: 350,
        maxCoverageLamports: 5_000_000_000,
        triggerCondition: "team_eliminated_group_stage",
      },
      {
        name: "Qualification Shortfall Cover",
        type: "qualification" as const,
        description: "Payout if your team fails to qualify from the group stage.",
        premiumRateBps: 400,
        maxCoverageLamports: 7_500_000_000,
        triggerCondition: "team_fails_to_qualify",
      },
      {
        name: "Golden Boot Goal Insurance",
        type: "goal_insurance" as const,
        description: "Protects a stake tied to a player reaching a goal-scoring milestone.",
        premiumRateBps: 600,
        maxCoverageLamports: 3_000_000_000,
        triggerCondition: "player_misses_goal_milestone",
      },
    ]);
    console.log("Inserted 4 insurance products.");
  } else {
    console.log(`Insurance products already exist (${existingProducts.length}), skipping.`);
  }

  const existingPools = await db.select().from(liquidityPoolsTable);
  if (existingPools.length === 0) {
    await db.insert(liquidityPoolsTable).values([
      { marketType: "match_winner" as const, totalLiquidityLamports: 0, aprBps: 1200, providerCount: 0 },
      { marketType: "draw" as const, totalLiquidityLamports: 0, aprBps: 900, providerCount: 0 },
      { marketType: "double_chance" as const, totalLiquidityLamports: 0, aprBps: 800, providerCount: 0 },
      { marketType: "exact_score" as const, totalLiquidityLamports: 0, aprBps: 2200, providerCount: 0 },
      { marketType: "first_scorer" as const, totalLiquidityLamports: 0, aprBps: 1800, providerCount: 0 },
      { marketType: "anytime_scorer" as const, totalLiquidityLamports: 0, aprBps: 1400, providerCount: 0 },
      { marketType: "over_under_goals" as const, totalLiquidityLamports: 0, aprBps: 1000, providerCount: 0 },
      { marketType: "corners" as const, totalLiquidityLamports: 0, aprBps: 1100, providerCount: 0 },
      { marketType: "cards" as const, totalLiquidityLamports: 0, aprBps: 1100, providerCount: 0 },
      { marketType: "both_teams_score" as const, totalLiquidityLamports: 0, aprBps: 950, providerCount: 0 },
      { marketType: "tournament_winner" as const, totalLiquidityLamports: 0, aprBps: 1600, providerCount: 0 },
      { marketType: "group_winner" as const, totalLiquidityLamports: 0, aprBps: 1300, providerCount: 0 },
    ]);
    console.log("Inserted 12 liquidity pools.");
  } else {
    console.log(`Liquidity pools already exist (${existingPools.length}), skipping.`);
  }

  const existingProposals = await db.select().from(governanceProposalsTable);
  if (existingProposals.length === 0) {
    const oneWeekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.insert(governanceProposalsTable).values([
      {
        title: "Reduce platform fee on custom markets from 2% to 1.5%",
        description:
          "Lowering the platform fee on user-created custom markets to encourage more community-driven market creation during the FIFA World Cup tournament.",
        endsAt: oneWeekFromNow,
      },
      {
        title: "Add corner-kick insurance product",
        description:
          "Introduce a new insurance product type covering under/over corner-kick totals for high-profile matches.",
        endsAt: oneWeekFromNow,
      },
      {
        title: "Increase liquidity provider APR for exact-score markets",
        description:
          "Exact-score markets carry higher risk for LPs. This proposal raises the APR from 22% to 28% to attract more liquidity.",
        endsAt: oneWeekFromNow,
      },
    ]);
    console.log("Inserted 3 governance proposals.");
  } else {
    console.log(`Governance proposals already exist (${existingProposals.length}), skipping.`);
  }

  console.log("\nSeed complete. Matches/markets intentionally left empty — synced only from TxLINE oracle once activated.");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exitCode = 1;
});
