import { Router } from 'express';
import {
    saveQuizScore,
    getUserQuizScore,
    getUserQuizMeta,
    getUserQuizAnswerStats,
} from '../../controllers/quiz/quizScore.controller.js';

const router = Router();

router.post('/save', saveQuizScore);
router.get('/:id', getUserQuizScore);
router.get('/pathway/:id', getUserQuizMeta);
router.get('/stats/:id', getUserQuizAnswerStats);

export default router;
