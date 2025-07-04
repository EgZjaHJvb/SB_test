import express from 'express';
import auth from '../../middleware/auth.js';
import {
    uploadMaterial,
    getMaterials,
    getAllAccessibleMaterials,
} from '../../controllers/material/material.controller.js';
import { upload } from '../../middleware/upload.middleware.js';

const router = express.Router();

// ✅ Upload other materials (notes, videos, etc.)
router.post('/upload', auth, upload.single('file'), uploadMaterial);

// ✅ Get other materials
router.get('/', getMaterials);

// ✅ Get all accessible materials (public + user's private)
router.get('/all-accessible', auth, getAllAccessibleMaterials);

export default router;
