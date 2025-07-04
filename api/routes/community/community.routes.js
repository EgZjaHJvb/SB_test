import express from 'express';
import multer from 'multer';
import auth from '../../middleware/auth.js';
import { uploadToCloudinary } from '../../middleware/cloudinaryUpload.js';
import CommunityPost from '../../models/community/CommunityPost.model.js';

const router = express.Router();
const upload = multer();

/**
 * Handles uploading a note as a community post, including file upload to Cloudinary.
 * @route POST /community/upload
 * @access Protected
 * @param {Express.Request} req - The request object, expects a file and form fields.
 * @param {Express.Response} res - The response object.
 */
router.post('/upload', auth, upload.single('note'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const fileName = req.file.originalname.split('.')[0] + '-' + Date.now();
        const uploadResult = await uploadToCloudinary(req.file.buffer, fileName, req.file.mimetype);
        const attachmentType = req.file.mimetype.includes('pdf')
            ? 'pdf'
            : req.file.mimetype.includes('image')
              ? 'image'
              : 'link';
        const newPost = new CommunityPost({
            author: req.user._id,
            title: req.body.title || fileName,
            description: req.body.description || '',
            syllabus: Array.isArray(req.body.syllabus) ? req.body.syllabus[0] : req.body.syllabus,
            subject: Array.isArray(req.body.subject) ? req.body.subject[0] : req.body.subject,
            tags: Array.isArray(req.body.tags)
                ? req.body.tags.flatMap((t) => t.split(',').map((s) => s.trim())).filter(Boolean)
                : typeof req.body.tags === 'string' && req.body.tags.length > 0
                  ? req.body.tags.split(',').map((t) => t.trim())
                  : [],
            type: req.body.type || 'note',
            attachments: [{ type: attachmentType, url: uploadResult.secure_url }],
        });
        await newPost.save();
        res.status(201).json({ message: 'Note uploaded successfully', post: newPost });
    } catch (error) {
        console.error('Error uploading note:', error);
        res.status(500).json({ error: 'Failed to upload note' });
    }
});

/**
 * Fetches all community posts, sorted by creation date, with author populated.
 * @route GET /community/posts
 * @access Public
 * @param {Express.Request} req - The request object.
 * @param {Express.Response} res - The response object.
 */
router.get('/posts', async (req, res) => {
    try {
        const posts = await CommunityPost.find()
            .sort({ createdAt: -1 })
            .populate('author', 'username email');
        res.json({ posts });
    } catch (error) {
        console.error('Error fetching community posts:', error);
        res.status(500).json({ error: 'Failed to fetch posts' });
    }
});

/**
 * Add a comment to a community post
 * @route POST /community/:id/comment
 * @access Protected
 */
router.post('/:id/comment', auth, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: 'Comment text is required' });
        const post = await CommunityPost.findById(req.params.id);
        if (!post) return res.status(404).json({ error: 'Post not found' });
        post.comments.push({ userId: req.user._id, text });
        await post.save();
        res.status(201).json({ message: 'Comment added', comments: post.comments });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

/**
 * Like or unlike a community post
 * @route POST /community/:id/like
 * @access Protected
 */
router.post('/:id/like', auth, async (req, res) => {
    try {
        const post = await CommunityPost.findById(req.params.id);
        if (!post) return res.status(404).json({ error: 'Post not found' });
        // Fix: Ensure post.likes is always an array
        if (!Array.isArray(post.likes)) post.likes = [];
        // Fix: Ensure req.user._id is a string
        const userId = (req.user._id || req.user.id || '').toString();
        if (!userId) return res.status(400).json({ error: 'User ID missing' });
        const index = post.likes.findIndex((id) => id && id.toString() === userId);
        let liked;
        if (index === -1) {
            post.likes.push(userId);
            liked = true;
        } else {
            post.likes.splice(index, 1);
            liked = false;
        }
        await post.save();
        res.json({ liked, likes: post.likes.length });
    } catch (error) {
        console.error('Error liking post:', error);
        res.status(500).json({ error: 'Failed to like/unlike post' });
    }
});

export default router;
