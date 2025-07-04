import express from 'express';
import { checkFileNSFW } from '../controllers/nsfwController.js';

const router = express.Router();

router.post('/check-file-nsfw', checkFileNSFW);

export default router;
