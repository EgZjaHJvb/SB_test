import express from 'express';
import {
    getAllChapters,
    getSubtopicsByChapter,
    getAllQuestionsBySubtopic,
    getFillUpsBySubtopic,
    getChapterById,
} from '../../../controllers/quiz/biology/biology.controller.js';

const router = express.Router();

router.get('/biology/chapters', getAllChapters);
router.get('/biology/chapters/:chapterId', getChapterById);
router.get('/biology/chapters/:chapterId/subtopics', getSubtopicsByChapter);
router.get('/biology/chapters/:chapterId/subtopics/:subtopicId', getAllQuestionsBySubtopic);

router.get('/biology/chapters/:chapterId/subtopics/:subtopicId/fillUps', getFillUpsBySubtopic);

/* Brain storming .................. 
/biology/chapters > all chapters

/chapters/chatperID/subtopics > all sub topics of spec topic
/chapters/chatperID/subtopics/:subtopicID > ques of that sub topic

/chapters/chatperID/subtopics/:subtopicID/fillUps > retrieve all fillups of that sub topic

*/

export default router;