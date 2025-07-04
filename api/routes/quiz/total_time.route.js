import express from 'express';
import { getMonthlyStudyTime } from '../../controllers/quiz/total_time.controller.js';

const router = express.Router();

router.get('/:userId', getMonthlyStudyTime);

export default router;