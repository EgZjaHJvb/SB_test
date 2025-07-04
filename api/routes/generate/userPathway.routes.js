// userPathway.routes.js
import express from 'express';
import {
    createUserPathway,
    getUserPathways,
    getPathwayById,
    updateUserPathway,
    deleteUserPathway,
    getPublicPathways
} from '../../controllers/generate/userPathway.controller.js';
// import { protect } from '../middleware/authMiddleware.js'; // Temporarily comment out for testing

const router = express.Router();

// Define API routes
// REMOVED 'protect' middleware and added :userId param for testing getUserPathways
router.post('/', createUserPathway); // Create pathway (userId from req.body)
router.get('/my/:userId', getUserPathways);  // Get user's pathways (userId from req.params)
router.get('/public', getPublicPathways); // Get all public pathways (no auth needed)
router.get('/:id', getPathwayById); // Get specific pathway by ID (no auth, access logic relaxed in controller)
router.put('/:id', updateUserPathway); // Update pathway (userId from req.body)
router.delete('/:id', deleteUserPathway); // Delete pathway (userId from req.body)

export default router;