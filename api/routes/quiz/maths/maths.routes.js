import express from 'express';
import {
    getAllChapters,
    getSubtopicsByChapter,
    getAllQuestionsBySubtopic,
    getFillUpsBySubtopic,
    getChapterById,
} from '../../../controllers/quiz/maths/maths.controller.js'; // Assuming a maths controller

const router = express.Router();

router.get('/maths/chapters', getAllChapters);
router.get('/maths/chapters/:chapterId', getChapterById);
router.get('/maths/chapters/:chapterId/subtopics', getSubtopicsByChapter);
router.get('/maths/chapters/:chapterId/subtopics/:subtopicId', getAllQuestionsBySubtopic);
router.get('/maths/chapters/:chapterId/subtopics/:subtopicId/fillUps', getFillUpsBySubtopic);

export default router;