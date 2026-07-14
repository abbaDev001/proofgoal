import { Router, type IRouter } from "express";
import healthRouter from "./health";
import integrationRouter from "./integration";
import usersRouter from "./users";
import matchesRouter from "./matches";
import marketsRouter from "./markets";
import positionsRouter from "./positions";
import insuranceRouter from "./insurance";
import proofsRouter from "./proofs";
import portfolioRouter from "./portfolio";
import analyticsRouter from "./analytics";
import liquidityRouter from "./liquidity";
import governanceRouter from "./governance";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(integrationRouter);
router.use(usersRouter);
router.use(matchesRouter);
router.use(marketsRouter);
router.use(positionsRouter);
router.use(insuranceRouter);
router.use(proofsRouter);
router.use(portfolioRouter);
router.use(analyticsRouter);
router.use(liquidityRouter);
router.use(governanceRouter);
router.use(adminRouter);

export default router;
