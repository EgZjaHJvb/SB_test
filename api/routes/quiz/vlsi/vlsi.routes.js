// routes/vlsi.routes.js

import express from 'express';
import {
    getAllChapters,
    getChapterById,
    getSubtopicsByChapter,
    getAllQuestionsBySubtopic,
    getFillUpsBySubtopic,
    // getFlashcardsBySubtopic
} from '../../../controllers/quiz/vlsi/vlsi.controller.js';

const router = express.Router();

router.get('/vlsi/chapters', getAllChapters);
router.get('/vlsi/chapters/:chapterId', getChapterById);
router.get('/vlsi/chapters/:chapterId/subtopics', getSubtopicsByChapter);
router.get('/vlsi/chapters/:chapterId/subtopics/:subtopicId', getAllQuestionsBySubtopic);
router.get('/vlsi/chapters/:chapterId/subtopics/:subtopicId/fillUps', getFillUpsBySubtopic);

// router.get('/vlsi/chapters/:chapterId/subtopics/:subtopicId/flashcard', getFlashcardsBySubtopic);

export default router;
