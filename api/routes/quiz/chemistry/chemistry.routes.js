import express from 'express';
import {
    getAllChapters,
    getSubtopicsByChapter,
    getAllQuestionsBySubtopic,
    getFillUpsBySubtopic,
    getChapterById,
} from '../../../controllers/quiz/chemistry/chemistry.controller.js'; // Assuming a chemistry controller

const router = express.Router();

router.get('/chemistry/chapters', getAllChapters);
router.get('/chemistry/chapters/:chapterId', getChapterById);
router.get('/chemistry/chapters/:chapterId/subtopics', getSubtopicsByChapter);
router.get('/chemistry/chapters/:chapterId/subtopics/:subtopicId', getAllQuestionsBySubtopic);
router.get('/chemistry/chapters/:chapterId/subtopics/:subtopicId/fillUps', getFillUpsBySubtopic);

export default router;