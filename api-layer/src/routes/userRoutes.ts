// src/routes/marketRoutes.ts

import { Router } from "express";
import * as marketController from "../controllers/marketController";
// import { validateOrder } from '../middleware/validator';

const router = Router();

router.post("/myOrders", marketController.createOrder);
router.delete("/myBalances", marketController.deleteOrder);
router.get("/orderHistory", marketController.fetchOrderBook);

export default router;
