import express from 'express';
import { saveQuizAttempt } from '../../controllers/quiz/quiz_attempt.controller.js';

const router = express.Router();

// POST route to save the quiz attempt data
router.post('/save', saveQuizAttempt);

export default router;
