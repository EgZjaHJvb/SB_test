// userPathway.controller.js
import UserPathway from '../../models/generate/userPathway.model.js';
import mongoose from 'mongoose';

// Helper to validate ObjectId (optional, but good practice)
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// @desc    Create a new user pathway
// @route   POST /api/v1/userPathway
// @access  Public (or controlled by logic within if not using middleware)
export const createUserPathway = async (req, res) => {
    // Destructure userId directly from req.body
    const { name, documents, access, userId } = req.body;

    // IMPORTANT: When relying on frontend to send userId,
    // ensure you have strong security measures in place on the frontend
    // to prevent unauthorized users from sending arbitrary user IDs.
    // Ideally, a token-based authentication system with middleware
    // is more secure for associating actions with the correct user.

    if (!userId || !name || !documents || !Array.isArray(documents) || documents.length === 0) {
        return res.status(400).json({ message: 'User ID, pathway name, and documents array are required.' });
    }

    // Validate userId as a valid MongoDB ObjectId
    if (!isValidObjectId(userId)) {
        return res.status(400).json({ message: 'Invalid user ID format.' });
    }

    // Validate document IDs (optional, but recommended)
    const invalidDocs = documents.filter(docId => !isValidObjectId(docId));
    if (invalidDocs.length > 0) {
        return res.status(400).json({ message: 'Invalid document IDs provided.', invalidDocs });
    }

    try {
        const newPathway = new UserPathway({
            userId, // Use the userId from the request body
            name,
            documents,
            access: access || 'private', // Default to private if not specified
        });

        const savedPathway = await newPathway.save();
        res.status(201).json({ message: 'Pathway created successfully!', pathway: savedPathway });
    } catch (error) {
        console.error('Error creating user pathway:', error);
        res.status(500).json({ message: 'Server error while creating pathway.', error: error.message });
    }
};

// @desc    Get all pathways for a specific user
// @route   GET /api/v1/pathways/my
// @access  Public (will need to pass userId in query/body for this approach)
export const getUserPathways = async (req, res) => {
    // If not using middleware, you'd get userId from query params or body
    // For GET requests, query params are common: req.query.userId
    const { userId } = req.params; // Assuming userId is passed as a query parameter

    if (!userId || !isValidObjectId(userId)) {
        return res.status(400).json({ message: 'A valid user ID is required to fetch pathways.' });
    }

    try {
        const pathways = await UserPathway.find({ userId }).populate('documents', 'filename subject');
        res.status(200).json({ pathways });
    } catch (error) {
        console.error('Error fetching user pathways:', error);
        res.status(500).json({ message: 'Server error while fetching pathways.', error: error.message });
    }
};

// @desc    Get a single pathway by ID
// @route   GET /api/v1/pathways/:id
// @access  Public (or Private depending on access setting)
export const getPathwayById = async (req, res) => {
    const { id } = req.params;
    // If you need to check ownership for private pathways without middleware,
    // you'll also need to pass the requesting user's ID here (e.g., req.query.requestingUserId)

    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: 'Invalid pathway ID.' });
    }

    try {
        const pathway = await UserPathway.findById(id).populate('documents', 'filename subject');

        if (!pathway) {
            return res.status(404).json({ message: 'Pathway not found.' });
        }

        // If you're not using middleware, you can't rely on req.user for authorization.
        // You would need to pass the "requesting user's ID" from the frontend
        // and compare it to pathway.userId.
        // For example: const requestingUserId = req.query.requestingUserId;
        // Then: if (pathway.access === 'private' && pathway.userId.toString() !== requestingUserId) { ... }
        // For simplicity, I'm removing the middleware-dependent part, but
        // be aware this makes all fetched pathways publicly accessible to anyone
        // who knows the ID, unless you implement another check.

        res.status(200).json({ pathway });
    } catch (error) {
        console.error('Error fetching pathway by ID:', error);
        res.status(500).json({ message: 'Server error while fetching pathway.', error: error.message });
    }
};

// @desc    Update a user pathway
// @route   PUT /api/v1/pathways/:id
// @access  Public (requires userId to be passed for authorization)
export const updateUserPathway = async (req, res) => {
    const { id } = req.params;
    const { name, documents, access, userId } = req.body; // Expect userId from body for authorization

    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: 'Invalid pathway ID.' });
    }

    if (!userId || !isValidObjectId(userId)) {
        return res.status(400).json({ message: 'A valid user ID is required for authorization.' });
    }

    // Validate document IDs if documents are being updated
    if (documents && (!Array.isArray(documents) || documents.length === 0)) {
        return res.status(400).json({ message: 'Documents must be a non-empty array.' });
    }
    if (documents) {
        const invalidDocs = documents.filter(docId => !isValidObjectId(docId));
        if (invalidDocs.length > 0) {
            return res.status(400).json({ message: 'Invalid document IDs provided.', invalidDocs });
        }
    }

    try {
        const pathway = await UserPathway.findById(id);

        if (!pathway) {
            return res.status(404).json({ message: 'Pathway not found.' });
        }

        // Ensure only the correct user (based on userId from body) can update
        if (pathway.userId.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized to update this pathway.' });
        }

        pathway.name = name || pathway.name;
        pathway.documents = documents || pathway.documents;
        pathway.access = access || pathway.access;

        const updatedPathway = await pathway.save();
        res.status(200).json({ message: 'Pathway updated successfully!', pathway: updatedPathway });
    } catch (error) {
        console.error('Error updating user pathway:', error);
        res.status(500).json({ message: 'Server error while updating pathway.', error: error.message });
    }
};

// @desc    Delete a user pathway
// @route   DELETE /api/v1/pathways/:id
// @access  Public (requires userId to be passed for authorization)
export const deleteUserPathway = async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body; // Expect userId from body for authorization (or query for DELETE)

    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: 'Invalid pathway ID.' });
    }

    if (!userId || !isValidObjectId(userId)) {
        return res.status(400).json({ message: 'A valid user ID is required for authorization.' });
    }

    try {
        const pathway = await UserPathway.findById(id);

        if (!pathway) {
            return res.status(404).json({ message: 'Pathway not found.' });
        }

        // Ensure only the correct user (based on userId from body) can delete
        if (pathway.userId.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized to delete this pathway.' });
        }

        await UserPathway.deleteOne({ _id: id });
        res.status(200).json({ message: 'Pathway deleted successfully!' });
    } catch (error) {
        console.error('Error deleting user pathway:', error);
        res.status(500).json({ message: 'Server error while deleting pathway.', error: error.message });
    }
};

// @desc    Get all public pathways
// @route   GET /api/v1/pathways/public
// @access  Public
export const getPublicPathways = async (req, res) => {
    try {
        const publicPathways = await UserPathway.find({ access: 'public' }).populate('documents', 'filename subject');
        res.status(200).json({ pathways: publicPathways });
    } catch (error) {
        console.error('Error fetching public pathways:', error);
        res.status(500).json({ message: 'Server error while fetching public pathways.', error: error.message });
    }
};