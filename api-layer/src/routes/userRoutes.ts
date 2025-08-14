import { Router } from "express";
import * as userController from "@/controllers/userController";
import { authenticateUser } from "@/middleware/authMiddleware";
import { requestLimiters } from "@/middleware/rate-limiter";

const router = Router();

router.post(
  "/",
  requestLimiters.sensitive,
  userController.createUser,
);

router.get(
  "/:id",
  requestLimiters.default,
  authenticateUser,
  userController.getUser,
);

router.get(
  "/orders",
  requestLimiters.default,
  authenticateUser,
  userController.getOrders,
);

export default router;
