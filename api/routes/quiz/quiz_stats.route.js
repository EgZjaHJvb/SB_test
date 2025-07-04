import express from 'express';
import { getTotalQuizAttempts } from '../../controllers/quiz/quiz_stats.controller.js';

const router = express.Router();

router.get('/:userId', getTotalQuizAttempts);

export default router;
