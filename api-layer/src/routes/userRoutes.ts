// src/routes/marketRoutes.ts

import { Router } from "express";
import * as userController from "@/controllers/userController";
import { authenticateUser } from "@/middleware/authMiddleware";

const router = Router();

router.post("/myOrders", authenticateUser, userController.orderHistory);
router.delete("/myBalances", userController.myBalances);
router.get("/orderHistory", userController.openOrders);

export default router;
