import { z } from "zod/v4";
export declare const liquidityPoolsTable: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "liquidity_pools";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "liquidity_pools";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        marketType: import("drizzle-orm/pg-core").PgColumn<{
            name: "market_type";
            tableName: "liquidity_pools";
            dataType: "string";
            columnType: "PgText";
            data: "custom" | "match_winner" | "draw" | "double_chance" | "exact_score" | "first_scorer" | "anytime_scorer" | "over_under_goals" | "corners" | "cards" | "both_teams_score" | "tournament_winner" | "group_winner";
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["match_winner", "draw", "double_chance", "exact_score", "first_scorer", "anytime_scorer", "over_under_goals", "corners", "cards", "both_teams_score", "tournament_winner", "group_winner", "custom"];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        totalLiquidityLamports: import("drizzle-orm/pg-core").PgColumn<{
            name: "total_liquidity_lamports";
            tableName: "liquidity_pools";
            dataType: "number";
            columnType: "PgNumericNumber";
            data: number;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        aprBps: import("drizzle-orm/pg-core").PgColumn<{
            name: "apr_bps";
            tableName: "liquidity_pools";
            dataType: "number";
            columnType: "PgInteger";
            data: number;
            driverParam: string | number;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        providerCount: import("drizzle-orm/pg-core").PgColumn<{
            name: "provider_count";
            tableName: "liquidity_pools";
            dataType: "number";
            columnType: "PgInteger";
            data: number;
            driverParam: string | number;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
export declare const insertLiquidityPoolSchema: z.ZodObject<{
    marketType: z.ZodEnum<{
        custom: "custom";
        match_winner: "match_winner";
        draw: "draw";
        double_chance: "double_chance";
        exact_score: "exact_score";
        first_scorer: "first_scorer";
        anytime_scorer: "anytime_scorer";
        over_under_goals: "over_under_goals";
        corners: "corners";
        cards: "cards";
        both_teams_score: "both_teams_score";
        tournament_winner: "tournament_winner";
        group_winner: "group_winner";
    }>;
    totalLiquidityLamports: z.ZodOptional<z.ZodNumber>;
    aprBps: z.ZodOptional<z.ZodInt>;
    providerCount: z.ZodOptional<z.ZodInt>;
}, {
    out: {};
    in: {};
}>;
export type InsertLiquidityPool = z.infer<typeof insertLiquidityPoolSchema>;
export type LiquidityPool = typeof liquidityPoolsTable.$inferSelect;
//# sourceMappingURL=liquidity.d.ts.map