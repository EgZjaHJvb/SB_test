// routes/userProgressRoutes.js
import express from 'express'
import { getUserProgress, updateUserProgress } from '../../controllers/quiz/userProgress.controller.js';
const router = express.Router();

// You might want to add authentication middleware here, e.g., router.get('/:userId/:subject', authMiddleware, getUserProgress);
router.get('/:userId/:subject', getUserProgress);
router.put('/', updateUserProgress); // Or PATCH if you prefer semantic PATCH for partial updates


export default router