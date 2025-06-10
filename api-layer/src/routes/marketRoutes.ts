// src/routes/marketRoutes.ts

import { Router } from 'express';
import * as marketController from '../controllers/marketController';
import { validateOrder } from '../middleware/validator';

const router = Router();

router.post('/orders', validateOrder, marketController.createOrder);
router.delete('/orders/:symbol/:orderId', marketController.deleteOrder);
router.get('/orderbook/:symbol', marketController.fetchOrderBook);
router.get('/ticker/:symbol', marketController.fetchTicker);
router.get('/trades/:symbol', marketController.fetchTrades);

export default router;