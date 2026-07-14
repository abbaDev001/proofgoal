import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  ConnectWalletBody,
  ConnectWalletResponse,
  GetUserParams,
  GetUserResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/users/connect", async (req, res): Promise<void> => {
  const parsed = ConnectWalletBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.walletAddress, parsed.data.walletAddress));

  if (existing) {
    res.json(ConnectWalletResponse.parse(existing));
    return;
  }

  const [created] = await db
    .insert(usersTable)
    .values({ walletAddress: parsed.data.walletAddress })
    .returning();

  res.json(ConnectWalletResponse.parse(created));
});

router.get("/users/:walletAddress", async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.walletAddress, params.data.walletAddress));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(GetUserResponse.parse(user));
});

export default router;
