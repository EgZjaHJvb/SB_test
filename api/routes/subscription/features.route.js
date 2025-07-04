// routes/subscription/features.routes.js
import express from 'express';
import authFullUser from '../../middleware/authFullUser.js'; 
import {checkFeatureAccess} from '../../middleware/checkFeatureAccess.js';
// import {planFeatures } from '../../controllers/subscription/planFeatures.controller.js'

const router = express.Router();

/**
 * @route   GET /api/v1/subscription/features/:featureKey
 * @desc    Check if the logged-in user can access a specific feature
 * @access  Private (requires authentication)
 *
 * Middleware:
 * - authFullUser: verifies the user's identity and attaches user info to req.user
 * - checkFeatureAccess: verifies if user's subscription plan grants access to requested feature
 */
// router.get('/:featureKey', authFullUser, checkFeatureAccess, planFeatures);

export default router;


// // routes/quiz.routes.js (simplified)
// import express from 'express';
// import authFullUser from '../middleware/authFullUser.js';
// import checkFeatureAccess from '../middleware/checkFeatureAccess.js';
// import { generateQuiz } from '../controllers/quiz.controller.js';

// const router = express.Router();

// router.post(
//   '/generate',
//   authFullUser,
//   checkFeatureAccess('ai-powered-quiz-generation'),  // Check user subscription for this feature key
//   generateQuiz
// );

// export default router;






