import express from 'express';
import {
    getAllChapters,
    getSubtopicsByChapter,
    getAllQuestionsBySubtopic,
    getFillUpsBySubtopic,
    getChapterById,
} from '../../../controllers/quiz/physics/physics.controller.js';

const router = express.Router();

router.get('/physics/chapters', getAllChapters);
router.get('/physics/chapters/:chapterId', getChapterById);
router.get('/physics/chapters/:chapterId/subtopics', getSubtopicsByChapter);
router.get('/physics/chapters/:chapterId/subtopics/:subtopicId', getAllQuestionsBySubtopic);

router.get('/chapters/:chapterId/subtopics/:subtopicId/fillUps', getFillUpsBySubtopic);

export default router;
