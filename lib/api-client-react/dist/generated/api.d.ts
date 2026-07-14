import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { AnalyticsSummary, GovernanceProposal, GovernanceProposalInput, HealthStatus, InsurancePolicy, InsurancePolicyInput, InsuranceProduct, InsuranceProductInput, LiquidityPool, ListGovernanceProposalsParams, ListInsurancePoliciesParams, ListInsuranceProductsParams, ListMarketsParams, ListMatchesParams, ListPositionsParams, ListProofRecordsParams, Market, MarketInput, Match, MatchDetail, MatchEvent, PortfolioSummary, Position, PositionInput, ProofRecord, TxlineStatus, User, VolumePoint, Vote, VoteInput, WalletConnectInput } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType, BodyType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getHealthCheckUrl: () => string;
/**
 * Returns server health status
 * @summary Health check
 */
export declare const healthCheck: (options?: RequestInit) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetTxlineStatusUrl: () => string;
/**
 * @summary Get TxLINE oracle integration status
 */
export declare const getTxlineStatus: (options?: RequestInit) => Promise<TxlineStatus>;
export declare const getGetTxlineStatusQueryKey: () => readonly ["/api/integration/txline"];
export declare const getGetTxlineStatusQueryOptions: <TData = Awaited<ReturnType<typeof getTxlineStatus>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTxlineStatus>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getTxlineStatus>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetTxlineStatusQueryResult = NonNullable<Awaited<ReturnType<typeof getTxlineStatus>>>;
export type GetTxlineStatusQueryError = ErrorType<unknown>;
/**
 * @summary Get TxLINE oracle integration status
 */
export declare function useGetTxlineStatus<TData = Awaited<ReturnType<typeof getTxlineStatus>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTxlineStatus>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getConnectWalletUrl: () => string;
/**
 * @summary Register or fetch a user by Solana wallet address
 */
export declare const connectWallet: (walletConnectInput: WalletConnectInput, options?: RequestInit) => Promise<User>;
export declare const getConnectWalletMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof connectWallet>>, TError, {
        data: BodyType<WalletConnectInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof connectWallet>>, TError, {
    data: BodyType<WalletConnectInput>;
}, TContext>;
export type ConnectWalletMutationResult = NonNullable<Awaited<ReturnType<typeof connectWallet>>>;
export type ConnectWalletMutationBody = BodyType<WalletConnectInput>;
export type ConnectWalletMutationError = ErrorType<unknown>;
/**
* @summary Register or fetch a user by Solana wallet address
*/
export declare const useConnectWallet: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof connectWallet>>, TError, {
        data: BodyType<WalletConnectInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof connectWallet>>, TError, {
    data: BodyType<WalletConnectInput>;
}, TContext>;
export declare const getGetUserUrl: (walletAddress: string) => string;
/**
 * @summary Get user by wallet address
 */
export declare const getUser: (walletAddress: string, options?: RequestInit) => Promise<User>;
export declare const getGetUserQueryKey: (walletAddress: string) => readonly [`/api/users/${string}`];
export declare const getGetUserQueryOptions: <TData = Awaited<ReturnType<typeof getUser>>, TError = ErrorType<void>>(walletAddress: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getUser>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getUser>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetUserQueryResult = NonNullable<Awaited<ReturnType<typeof getUser>>>;
export type GetUserQueryError = ErrorType<void>;
/**
 * @summary Get user by wallet address
 */
export declare function useGetUser<TData = Awaited<ReturnType<typeof getUser>>, TError = ErrorType<void>>(walletAddress: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getUser>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListMatchesUrl: (params?: ListMatchesParams) => string;
/**
 * @summary List matches synced from TxLINE
 */
export declare const listMatches: (params?: ListMatchesParams, options?: RequestInit) => Promise<Match[]>;
export declare const getListMatchesQueryKey: (params?: ListMatchesParams) => readonly ["/api/matches", ...ListMatchesParams[]];
export declare const getListMatchesQueryOptions: <TData = Awaited<ReturnType<typeof listMatches>>, TError = ErrorType<unknown>>(params?: ListMatchesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listMatches>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listMatches>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListMatchesQueryResult = NonNullable<Awaited<ReturnType<typeof listMatches>>>;
export type ListMatchesQueryError = ErrorType<unknown>;
/**
 * @summary List matches synced from TxLINE
 */
export declare function useListMatches<TData = Awaited<ReturnType<typeof listMatches>>, TError = ErrorType<unknown>>(params?: ListMatchesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listMatches>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListLiveMatchesUrl: () => string;
/**
 * @summary List currently live matches with latest score/events
 */
export declare const listLiveMatches: (options?: RequestInit) => Promise<Match[]>;
export declare const getListLiveMatchesQueryKey: () => readonly ["/api/matches/live"];
export declare const getListLiveMatchesQueryOptions: <TData = Awaited<ReturnType<typeof listLiveMatches>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listLiveMatches>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listLiveMatches>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListLiveMatchesQueryResult = NonNullable<Awaited<ReturnType<typeof listLiveMatches>>>;
export type ListLiveMatchesQueryError = ErrorType<unknown>;
/**
 * @summary List currently live matches with latest score/events
 */
export declare function useListLiveMatches<TData = Awaited<ReturnType<typeof listLiveMatches>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listLiveMatches>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetMatchUrl: (matchId: string) => string;
/**
 * @summary Get a single match with markets summary
 */
export declare const getMatch: (matchId: string, options?: RequestInit) => Promise<MatchDetail>;
export declare const getGetMatchQueryKey: (matchId: string) => readonly [`/api/matches/${string}`];
export declare const getGetMatchQueryOptions: <TData = Awaited<ReturnType<typeof getMatch>>, TError = ErrorType<void>>(matchId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMatch>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getMatch>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetMatchQueryResult = NonNullable<Awaited<ReturnType<typeof getMatch>>>;
export type GetMatchQueryError = ErrorType<void>;
/**
 * @summary Get a single match with markets summary
 */
export declare function useGetMatch<TData = Awaited<ReturnType<typeof getMatch>>, TError = ErrorType<void>>(matchId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMatch>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListMatchEventsUrl: (matchId: string) => string;
/**
 * @summary List match events (goals, cards, corners) synced from TxLINE
 */
export declare const listMatchEvents: (matchId: string, options?: RequestInit) => Promise<MatchEvent[]>;
export declare const getListMatchEventsQueryKey: (matchId: string) => readonly [`/api/matches/${string}/events`];
export declare const getListMatchEventsQueryOptions: <TData = Awaited<ReturnType<typeof listMatchEvents>>, TError = ErrorType<unknown>>(matchId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listMatchEvents>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listMatchEvents>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListMatchEventsQueryResult = NonNullable<Awaited<ReturnType<typeof listMatchEvents>>>;
export type ListMatchEventsQueryError = ErrorType<unknown>;
/**
 * @summary List match events (goals, cards, corners) synced from TxLINE
 */
export declare function useListMatchEvents<TData = Awaited<ReturnType<typeof listMatchEvents>>, TError = ErrorType<unknown>>(matchId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listMatchEvents>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListMarketsUrl: (params?: ListMarketsParams) => string;
/**
 * @summary List prediction markets
 */
export declare const listMarkets: (params?: ListMarketsParams, options?: RequestInit) => Promise<Market[]>;
export declare const getListMarketsQueryKey: (params?: ListMarketsParams) => readonly ["/api/markets", ...ListMarketsParams[]];
export declare const getListMarketsQueryOptions: <TData = Awaited<ReturnType<typeof listMarkets>>, TError = ErrorType<unknown>>(params?: ListMarketsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listMarkets>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listMarkets>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListMarketsQueryResult = NonNullable<Awaited<ReturnType<typeof listMarkets>>>;
export type ListMarketsQueryError = ErrorType<unknown>;
/**
 * @summary List prediction markets
 */
export declare function useListMarkets<TData = Awaited<ReturnType<typeof listMarkets>>, TError = ErrorType<unknown>>(params?: ListMarketsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listMarkets>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateCustomMarketUrl: () => string;
/**
 * @summary Create a user-defined custom market
 */
export declare const createCustomMarket: (marketInput: MarketInput, options?: RequestInit) => Promise<Market>;
export declare const getCreateCustomMarketMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createCustomMarket>>, TError, {
        data: BodyType<MarketInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createCustomMarket>>, TError, {
    data: BodyType<MarketInput>;
}, TContext>;
export type CreateCustomMarketMutationResult = NonNullable<Awaited<ReturnType<typeof createCustomMarket>>>;
export type CreateCustomMarketMutationBody = BodyType<MarketInput>;
export type CreateCustomMarketMutationError = ErrorType<unknown>;
/**
* @summary Create a user-defined custom market
*/
export declare const useCreateCustomMarket: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createCustomMarket>>, TError, {
        data: BodyType<MarketInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createCustomMarket>>, TError, {
    data: BodyType<MarketInput>;
}, TContext>;
export declare const getGetMarketUrl: (marketId: string) => string;
/**
 * @summary Get market detail with selections and odds
 */
export declare const getMarket: (marketId: string, options?: RequestInit) => Promise<Market>;
export declare const getGetMarketQueryKey: (marketId: string) => readonly [`/api/markets/${string}`];
export declare const getGetMarketQueryOptions: <TData = Awaited<ReturnType<typeof getMarket>>, TError = ErrorType<void>>(marketId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMarket>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getMarket>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetMarketQueryResult = NonNullable<Awaited<ReturnType<typeof getMarket>>>;
export type GetMarketQueryError = ErrorType<void>;
/**
 * @summary Get market detail with selections and odds
 */
export declare function useGetMarket<TData = Awaited<ReturnType<typeof getMarket>>, TError = ErrorType<void>>(marketId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMarket>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListPositionsUrl: (params: ListPositionsParams) => string;
/**
 * @summary List positions for a wallet
 */
export declare const listPositions: (params: ListPositionsParams, options?: RequestInit) => Promise<Position[]>;
export declare const getListPositionsQueryKey: (params?: ListPositionsParams) => readonly ["/api/positions", ...ListPositionsParams[]];
export declare const getListPositionsQueryOptions: <TData = Awaited<ReturnType<typeof listPositions>>, TError = ErrorType<unknown>>(params: ListPositionsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPositions>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listPositions>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListPositionsQueryResult = NonNullable<Awaited<ReturnType<typeof listPositions>>>;
export type ListPositionsQueryError = ErrorType<unknown>;
/**
 * @summary List positions for a wallet
 */
export declare function useListPositions<TData = Awaited<ReturnType<typeof listPositions>>, TError = ErrorType<unknown>>(params: ListPositionsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPositions>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreatePositionUrl: () => string;
/**
 * @summary Place a position (stake) on a market selection - escrowed pending settlement
 */
export declare const createPosition: (positionInput: PositionInput, options?: RequestInit) => Promise<Position>;
export declare const getCreatePositionMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createPosition>>, TError, {
        data: BodyType<PositionInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createPosition>>, TError, {
    data: BodyType<PositionInput>;
}, TContext>;
export type CreatePositionMutationResult = NonNullable<Awaited<ReturnType<typeof createPosition>>>;
export type CreatePositionMutationBody = BodyType<PositionInput>;
export type CreatePositionMutationError = ErrorType<unknown>;
/**
* @summary Place a position (stake) on a market selection - escrowed pending settlement
*/
export declare const useCreatePosition: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createPosition>>, TError, {
        data: BodyType<PositionInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createPosition>>, TError, {
    data: BodyType<PositionInput>;
}, TContext>;
export declare const getGetPositionUrl: (positionId: string) => string;
/**
 * @summary Get position detail including settlement record
 */
export declare const getPosition: (positionId: string, options?: RequestInit) => Promise<Position>;
export declare const getGetPositionQueryKey: (positionId: string) => readonly [`/api/positions/${string}`];
export declare const getGetPositionQueryOptions: <TData = Awaited<ReturnType<typeof getPosition>>, TError = ErrorType<void>>(positionId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPosition>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPosition>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPositionQueryResult = NonNullable<Awaited<ReturnType<typeof getPosition>>>;
export type GetPositionQueryError = ErrorType<void>;
/**
 * @summary Get position detail including settlement record
 */
export declare function useGetPosition<TData = Awaited<ReturnType<typeof getPosition>>, TError = ErrorType<void>>(positionId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPosition>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListInsuranceProductsUrl: (params?: ListInsuranceProductsParams) => string;
/**
 * @summary List available insurance products
 */
export declare const listInsuranceProducts: (params?: ListInsuranceProductsParams, options?: RequestInit) => Promise<InsuranceProduct[]>;
export declare const getListInsuranceProductsQueryKey: (params?: ListInsuranceProductsParams) => readonly ["/api/insurance/products", ...ListInsuranceProductsParams[]];
export declare const getListInsuranceProductsQueryOptions: <TData = Awaited<ReturnType<typeof listInsuranceProducts>>, TError = ErrorType<unknown>>(params?: ListInsuranceProductsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listInsuranceProducts>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listInsuranceProducts>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListInsuranceProductsQueryResult = NonNullable<Awaited<ReturnType<typeof listInsuranceProducts>>>;
export type ListInsuranceProductsQueryError = ErrorType<unknown>;
/**
 * @summary List available insurance products
 */
export declare function useListInsuranceProducts<TData = Awaited<ReturnType<typeof listInsuranceProducts>>, TError = ErrorType<unknown>>(params?: ListInsuranceProductsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listInsuranceProducts>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateInsuranceProductUrl: () => string;
/**
 * @summary Create a user-defined insurance product
 */
export declare const createInsuranceProduct: (insuranceProductInput: InsuranceProductInput, options?: RequestInit) => Promise<InsuranceProduct>;
export declare const getCreateInsuranceProductMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createInsuranceProduct>>, TError, {
        data: BodyType<InsuranceProductInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createInsuranceProduct>>, TError, {
    data: BodyType<InsuranceProductInput>;
}, TContext>;
export type CreateInsuranceProductMutationResult = NonNullable<Awaited<ReturnType<typeof createInsuranceProduct>>>;
export type CreateInsuranceProductMutationBody = BodyType<InsuranceProductInput>;
export type CreateInsuranceProductMutationError = ErrorType<unknown>;
/**
* @summary Create a user-defined insurance product
*/
export declare const useCreateInsuranceProduct: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createInsuranceProduct>>, TError, {
        data: BodyType<InsuranceProductInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createInsuranceProduct>>, TError, {
    data: BodyType<InsuranceProductInput>;
}, TContext>;
export declare const getGetInsuranceProductUrl: (productId: string) => string;
/**
 * @summary Get insurance product detail
 */
export declare const getInsuranceProduct: (productId: string, options?: RequestInit) => Promise<InsuranceProduct>;
export declare const getGetInsuranceProductQueryKey: (productId: string) => readonly [`/api/insurance/products/${string}`];
export declare const getGetInsuranceProductQueryOptions: <TData = Awaited<ReturnType<typeof getInsuranceProduct>>, TError = ErrorType<void>>(productId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getInsuranceProduct>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getInsuranceProduct>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetInsuranceProductQueryResult = NonNullable<Awaited<ReturnType<typeof getInsuranceProduct>>>;
export type GetInsuranceProductQueryError = ErrorType<void>;
/**
 * @summary Get insurance product detail
 */
export declare function useGetInsuranceProduct<TData = Awaited<ReturnType<typeof getInsuranceProduct>>, TError = ErrorType<void>>(productId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getInsuranceProduct>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListInsurancePoliciesUrl: (params: ListInsurancePoliciesParams) => string;
/**
 * @summary List insurance policies for a wallet
 */
export declare const listInsurancePolicies: (params: ListInsurancePoliciesParams, options?: RequestInit) => Promise<InsurancePolicy[]>;
export declare const getListInsurancePoliciesQueryKey: (params?: ListInsurancePoliciesParams) => readonly ["/api/insurance/policies", ...ListInsurancePoliciesParams[]];
export declare const getListInsurancePoliciesQueryOptions: <TData = Awaited<ReturnType<typeof listInsurancePolicies>>, TError = ErrorType<unknown>>(params: ListInsurancePoliciesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listInsurancePolicies>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listInsurancePolicies>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListInsurancePoliciesQueryResult = NonNullable<Awaited<ReturnType<typeof listInsurancePolicies>>>;
export type ListInsurancePoliciesQueryError = ErrorType<unknown>;
/**
 * @summary List insurance policies for a wallet
 */
export declare function useListInsurancePolicies<TData = Awaited<ReturnType<typeof listInsurancePolicies>>, TError = ErrorType<unknown>>(params: ListInsurancePoliciesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listInsurancePolicies>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getPurchaseInsurancePolicyUrl: () => string;
/**
 * @summary Purchase an insurance policy
 */
export declare const purchaseInsurancePolicy: (insurancePolicyInput: InsurancePolicyInput, options?: RequestInit) => Promise<InsurancePolicy>;
export declare const getPurchaseInsurancePolicyMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof purchaseInsurancePolicy>>, TError, {
        data: BodyType<InsurancePolicyInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof purchaseInsurancePolicy>>, TError, {
    data: BodyType<InsurancePolicyInput>;
}, TContext>;
export type PurchaseInsurancePolicyMutationResult = NonNullable<Awaited<ReturnType<typeof purchaseInsurancePolicy>>>;
export type PurchaseInsurancePolicyMutationBody = BodyType<InsurancePolicyInput>;
export type PurchaseInsurancePolicyMutationError = ErrorType<unknown>;
/**
* @summary Purchase an insurance policy
*/
export declare const usePurchaseInsurancePolicy: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof purchaseInsurancePolicy>>, TError, {
        data: BodyType<InsurancePolicyInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof purchaseInsurancePolicy>>, TError, {
    data: BodyType<InsurancePolicyInput>;
}, TContext>;
export declare const getGetInsurancePolicyUrl: (policyId: string) => string;
/**
 * @summary Get insurance policy detail
 */
export declare const getInsurancePolicy: (policyId: string, options?: RequestInit) => Promise<InsurancePolicy>;
export declare const getGetInsurancePolicyQueryKey: (policyId: string) => readonly [`/api/insurance/policies/${string}`];
export declare const getGetInsurancePolicyQueryOptions: <TData = Awaited<ReturnType<typeof getInsurancePolicy>>, TError = ErrorType<void>>(policyId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getInsurancePolicy>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getInsurancePolicy>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetInsurancePolicyQueryResult = NonNullable<Awaited<ReturnType<typeof getInsurancePolicy>>>;
export type GetInsurancePolicyQueryError = ErrorType<void>;
/**
 * @summary Get insurance policy detail
 */
export declare function useGetInsurancePolicy<TData = Awaited<ReturnType<typeof getInsurancePolicy>>, TError = ErrorType<void>>(policyId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getInsurancePolicy>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListProofRecordsUrl: (params?: ListProofRecordsParams) => string;
/**
 * @summary List proof/validation records for the explorer
 */
export declare const listProofRecords: (params?: ListProofRecordsParams, options?: RequestInit) => Promise<ProofRecord[]>;
export declare const getListProofRecordsQueryKey: (params?: ListProofRecordsParams) => readonly ["/api/proofs", ...ListProofRecordsParams[]];
export declare const getListProofRecordsQueryOptions: <TData = Awaited<ReturnType<typeof listProofRecords>>, TError = ErrorType<unknown>>(params?: ListProofRecordsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listProofRecords>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listProofRecords>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListProofRecordsQueryResult = NonNullable<Awaited<ReturnType<typeof listProofRecords>>>;
export type ListProofRecordsQueryError = ErrorType<unknown>;
/**
 * @summary List proof/validation records for the explorer
 */
export declare function useListProofRecords<TData = Awaited<ReturnType<typeof listProofRecords>>, TError = ErrorType<unknown>>(params?: ListProofRecordsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listProofRecords>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetProofRecordUrl: (proofId: string) => string;
/**
 * @summary Get a single proof record with merkle path and verification receipt
 */
export declare const getProofRecord: (proofId: string, options?: RequestInit) => Promise<ProofRecord>;
export declare const getGetProofRecordQueryKey: (proofId: string) => readonly [`/api/proofs/${string}`];
export declare const getGetProofRecordQueryOptions: <TData = Awaited<ReturnType<typeof getProofRecord>>, TError = ErrorType<void>>(proofId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getProofRecord>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getProofRecord>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetProofRecordQueryResult = NonNullable<Awaited<ReturnType<typeof getProofRecord>>>;
export type GetProofRecordQueryError = ErrorType<void>;
/**
 * @summary Get a single proof record with merkle path and verification receipt
 */
export declare function useGetProofRecord<TData = Awaited<ReturnType<typeof getProofRecord>>, TError = ErrorType<void>>(proofId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getProofRecord>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetPortfolioSummaryUrl: (walletAddress: string) => string;
/**
 * @summary Get aggregated portfolio summary for a wallet (positions + policies + P&L)
 */
export declare const getPortfolioSummary: (walletAddress: string, options?: RequestInit) => Promise<PortfolioSummary>;
export declare const getGetPortfolioSummaryQueryKey: (walletAddress: string) => readonly [`/api/portfolio/${string}`];
export declare const getGetPortfolioSummaryQueryOptions: <TData = Awaited<ReturnType<typeof getPortfolioSummary>>, TError = ErrorType<unknown>>(walletAddress: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPortfolioSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPortfolioSummary>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPortfolioSummaryQueryResult = NonNullable<Awaited<ReturnType<typeof getPortfolioSummary>>>;
export type GetPortfolioSummaryQueryError = ErrorType<unknown>;
/**
 * @summary Get aggregated portfolio summary for a wallet (positions + policies + P&L)
 */
export declare function useGetPortfolioSummary<TData = Awaited<ReturnType<typeof getPortfolioSummary>>, TError = ErrorType<unknown>>(walletAddress: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPortfolioSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetAnalyticsSummaryUrl: () => string;
/**
 * @summary Get platform-wide analytics summary (volume, open interest, active markets)
 */
export declare const getAnalyticsSummary: (options?: RequestInit) => Promise<AnalyticsSummary>;
export declare const getGetAnalyticsSummaryQueryKey: () => readonly ["/api/analytics/summary"];
export declare const getGetAnalyticsSummaryQueryOptions: <TData = Awaited<ReturnType<typeof getAnalyticsSummary>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAnalyticsSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAnalyticsSummary>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAnalyticsSummaryQueryResult = NonNullable<Awaited<ReturnType<typeof getAnalyticsSummary>>>;
export type GetAnalyticsSummaryQueryError = ErrorType<unknown>;
/**
 * @summary Get platform-wide analytics summary (volume, open interest, active markets)
 */
export declare function useGetAnalyticsSummary<TData = Awaited<ReturnType<typeof getAnalyticsSummary>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAnalyticsSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetVolumeSeriesUrl: () => string;
/**
 * @summary Get daily staked volume time series
 */
export declare const getVolumeSeries: (options?: RequestInit) => Promise<VolumePoint[]>;
export declare const getGetVolumeSeriesQueryKey: () => readonly ["/api/analytics/volume-series"];
export declare const getGetVolumeSeriesQueryOptions: <TData = Awaited<ReturnType<typeof getVolumeSeries>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getVolumeSeries>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getVolumeSeries>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetVolumeSeriesQueryResult = NonNullable<Awaited<ReturnType<typeof getVolumeSeries>>>;
export type GetVolumeSeriesQueryError = ErrorType<unknown>;
/**
 * @summary Get daily staked volume time series
 */
export declare function useGetVolumeSeries<TData = Awaited<ReturnType<typeof getVolumeSeries>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getVolumeSeries>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListLiquidityPoolsUrl: () => string;
/**
 * @summary List liquidity pools backing markets
 */
export declare const listLiquidityPools: (options?: RequestInit) => Promise<LiquidityPool[]>;
export declare const getListLiquidityPoolsQueryKey: () => readonly ["/api/liquidity/pools"];
export declare const getListLiquidityPoolsQueryOptions: <TData = Awaited<ReturnType<typeof listLiquidityPools>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listLiquidityPools>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listLiquidityPools>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListLiquidityPoolsQueryResult = NonNullable<Awaited<ReturnType<typeof listLiquidityPools>>>;
export type ListLiquidityPoolsQueryError = ErrorType<unknown>;
/**
 * @summary List liquidity pools backing markets
 */
export declare function useListLiquidityPools<TData = Awaited<ReturnType<typeof listLiquidityPools>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listLiquidityPools>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListGovernanceProposalsUrl: (params?: ListGovernanceProposalsParams) => string;
/**
 * @summary List governance proposals
 */
export declare const listGovernanceProposals: (params?: ListGovernanceProposalsParams, options?: RequestInit) => Promise<GovernanceProposal[]>;
export declare const getListGovernanceProposalsQueryKey: (params?: ListGovernanceProposalsParams) => readonly ["/api/governance/proposals", ...ListGovernanceProposalsParams[]];
export declare const getListGovernanceProposalsQueryOptions: <TData = Awaited<ReturnType<typeof listGovernanceProposals>>, TError = ErrorType<unknown>>(params?: ListGovernanceProposalsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listGovernanceProposals>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listGovernanceProposals>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListGovernanceProposalsQueryResult = NonNullable<Awaited<ReturnType<typeof listGovernanceProposals>>>;
export type ListGovernanceProposalsQueryError = ErrorType<unknown>;
/**
 * @summary List governance proposals
 */
export declare function useListGovernanceProposals<TData = Awaited<ReturnType<typeof listGovernanceProposals>>, TError = ErrorType<unknown>>(params?: ListGovernanceProposalsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listGovernanceProposals>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateGovernanceProposalUrl: () => string;
/**
 * @summary Create a new governance proposal
 */
export declare const createGovernanceProposal: (governanceProposalInput: GovernanceProposalInput, options?: RequestInit) => Promise<GovernanceProposal>;
export declare const getCreateGovernanceProposalMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createGovernanceProposal>>, TError, {
        data: BodyType<GovernanceProposalInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createGovernanceProposal>>, TError, {
    data: BodyType<GovernanceProposalInput>;
}, TContext>;
export type CreateGovernanceProposalMutationResult = NonNullable<Awaited<ReturnType<typeof createGovernanceProposal>>>;
export type CreateGovernanceProposalMutationBody = BodyType<GovernanceProposalInput>;
export type CreateGovernanceProposalMutationError = ErrorType<unknown>;
/**
* @summary Create a new governance proposal
*/
export declare const useCreateGovernanceProposal: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createGovernanceProposal>>, TError, {
        data: BodyType<GovernanceProposalInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createGovernanceProposal>>, TError, {
    data: BodyType<GovernanceProposalInput>;
}, TContext>;
export declare const getGetGovernanceProposalUrl: (proposalId: string) => string;
/**
 * @summary Get governance proposal detail with vote tallies
 */
export declare const getGovernanceProposal: (proposalId: string, options?: RequestInit) => Promise<GovernanceProposal>;
export declare const getGetGovernanceProposalQueryKey: (proposalId: string) => readonly [`/api/governance/proposals/${string}`];
export declare const getGetGovernanceProposalQueryOptions: <TData = Awaited<ReturnType<typeof getGovernanceProposal>>, TError = ErrorType<void>>(proposalId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getGovernanceProposal>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getGovernanceProposal>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetGovernanceProposalQueryResult = NonNullable<Awaited<ReturnType<typeof getGovernanceProposal>>>;
export type GetGovernanceProposalQueryError = ErrorType<void>;
/**
 * @summary Get governance proposal detail with vote tallies
 */
export declare function useGetGovernanceProposal<TData = Awaited<ReturnType<typeof getGovernanceProposal>>, TError = ErrorType<void>>(proposalId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getGovernanceProposal>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCastVoteUrl: (proposalId: string) => string;
/**
 * @summary Cast a vote on a governance proposal
 */
export declare const castVote: (proposalId: string, voteInput: VoteInput, options?: RequestInit) => Promise<Vote>;
export declare const getCastVoteMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof castVote>>, TError, {
        proposalId: string;
        data: BodyType<VoteInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof castVote>>, TError, {
    proposalId: string;
    data: BodyType<VoteInput>;
}, TContext>;
export type CastVoteMutationResult = NonNullable<Awaited<ReturnType<typeof castVote>>>;
export type CastVoteMutationBody = BodyType<VoteInput>;
export type CastVoteMutationError = ErrorType<unknown>;
/**
* @summary Cast a vote on a governance proposal
*/
export declare const useCastVote: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof castVote>>, TError, {
        proposalId: string;
        data: BodyType<VoteInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof castVote>>, TError, {
    proposalId: string;
    data: BodyType<VoteInput>;
}, TContext>;
export {};
//# sourceMappingURL=api.d.ts.map