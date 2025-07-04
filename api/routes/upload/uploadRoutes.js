import express from 'express';
import { uploadPodcasts } from '../../controllers/upload/upload.controller.js';
import { uploadMultiple } from '../../middleware/upload.middleware.js';
import { getPodcastsBySubject } from '../../controllers/upload/upload.controller.js';

const router = express.Router();

router.post("/upload", uploadMultiple, uploadPodcasts);


router.get("/shows", getPodcastsBySubject);

export default router;
