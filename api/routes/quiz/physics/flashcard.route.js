import express from 'express';
import { getFlashcardsBySubtopic } from '../../../controllers/quiz/physics/flashcard.controller.js';

const router = express.Router();

// Route for getting flashcards by subtopic
router.get('/subjects/:subject/chapters/:chapterId/subtopics/:subtopicId/flashcards', getFlashcardsBySubtopic);

export default router;
