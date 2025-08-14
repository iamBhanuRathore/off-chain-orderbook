// src/routes/marketRoutes.ts

import { Router } from "express";
import * as userController from "@/controllers/userController";
import { authenticateUser } from "@/middleware/authMiddleware";

const router = Router();

router.get("/orders", authenticateUser, userController.getOrders);

export default router;
