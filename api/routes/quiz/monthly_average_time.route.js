import express from 'express';
import { getMonthlyAverageStudyTime } from '../../controllers/quiz/monthly_average_time.controller.js';

const router = express.Router();

router.get('/:userId', getMonthlyAverageStudyTime);

export default router;