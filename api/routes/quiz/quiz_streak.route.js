import express from 'express';
import { getQuizStreak } from '../../controllers/quiz/quiz_streak.controller.js';

const router = express.Router();

router.get('/:userId', getQuizStreak);

export default router;