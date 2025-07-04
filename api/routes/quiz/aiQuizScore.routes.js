import express from 'express';
import {
    saveAIQuizScore,
    getAIQuizScores,
    getAIQuizScoreById,
    deleteAIQuizScore
} from '../../controllers/quiz/aiQuizScore.controller.js';

const router = express.Router();

// Save AI Quiz Score
router.post('/save', saveAIQuizScore);

// Get all AI Quiz Scores for a user
router.get('/user/:userId', getAIQuizScores);

// Get specific AI Quiz Score by ID
router.get('/:scoreId', getAIQuizScoreById);

// Delete AI Quiz Score
router.delete('/:scoreId', deleteAIQuizScore);

export default router; 