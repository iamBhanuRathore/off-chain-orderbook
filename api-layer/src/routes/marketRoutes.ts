import { Router } from "express";
import * as marketController from "../controllers/marketController";
import { validateOrder } from "../middleware/validator";
import { requestLimiters } from "../middleware/rate-limiter";
import { authenticateUser } from "../middleware/authMiddleware";

const router = Router();

router.post(
  "/orders",
  requestLimiters.sensitive,
  authenticateUser,
  validateOrder,
  marketController.createOrder,
);

router.delete(
  "/orders/:symbol/:orderId",
  requestLimiters.sensitive,
  authenticateUser,
  marketController.deleteOrder,
);

router.get(
  "/orderbook/:symbol",
  requestLimiters.default,
  marketController.fetchOrderBook,
);

router.get(
  "/ticker/:symbol",
  requestLimiters.default,
  marketController.fetchTicker,
);

router.get(
  "/trades/:symbol",
  requestLimiters.default,
  marketController.fetchTrades,
);

export default router;