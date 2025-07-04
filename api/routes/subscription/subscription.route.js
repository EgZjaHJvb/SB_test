import express from 'express';
import { createCheckoutSession , handleStripeWebhook ,verifySession,getCurrentSubscriptionStatus, getSubscriptionStatusByUserId } from '../../controllers/subscription/subscription.controller.js';
import authFullUser from '../../middleware/authFullUser.js';

const router = express.Router();

router.post('/create-checkout-session', authFullUser, createCheckoutSession);
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);
router.post('/verify-session', authFullUser, verifySession);
router.get('/status', authFullUser, getCurrentSubscriptionStatus);
router.get('/user/:userId/status', authFullUser, getSubscriptionStatusByUserId);

export default router;
