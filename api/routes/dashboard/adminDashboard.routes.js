import express from 'express';
import bcrypt from 'bcryptjs';
import AdminDashboard from '../../models/dashboard/AdminDashboard.model.js';
import User from '../../models/auth/User.model.js';
import auth from '../../middleware/auth.js';
const router = express.Router();

/**
 * Generates a unique 13-character code using alphabets, numbers, '@', and '&'
 * @param {string} input - Base string to generate unique code
 * @returns {string} A 13-character unique code
 */
const generateUniqueCode = (input) => {
    const allowedChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@&';
    let result = '';

    // Use the input string to seed the code
    const seed = input + Date.now().toString();

    // Generate 13 characters
    for (let i = 0; i < 13; i++) {
        // Create a hash-like value using the seed and position
        const charIndex =
            (seed.charCodeAt(i % seed.length) + i + seed.length) % allowedChars.length;

        result += allowedChars.charAt(charIndex);
    }

    return result;
};

/**
 * @desc Create a new admin dashboard
 * @route POST /admin/new
 * @access Protected
 * @param {Express.Request} req - The request object, expects a file and form fields.
 * @param {Express.Response} res - The response object.
 */
router.post('/new', auth, async (req, res) => {
    try {
        const { name, password } = req.body;
        if (!name || !password) {
            return res.status(400).json({ message: 'Name and password are required' });
        }
        if (!req.user.id) {
            return res.status(400).json({ message: 'User ID is missing' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        console.log('User ID:', user._id);
        console.log('User ID param:', req.user.id);

        const passwordHash = await bcrypt.hash(password, 10);
        const newAdminDashboard = await AdminDashboard.create({
            dashboardName: name,
            passwordHash,
            admins: [{ userId: user._id }],
            linkCode: 'temporary',
        });

        const linkCode = generateUniqueCode(newAdminDashboard._id.toString());
        newAdminDashboard.linkCode = linkCode;
        await newAdminDashboard.save();

        res.status(201).json({
            message: 'Admin dashboard created successfully',
            adminDashboard: newAdminDashboard,
        });
    } catch (error) {
        console.error('Error creating admin dashboard:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

/**
 * @desc    Get admin dashboard data
 * @route   GET /admin/dashboard
 * @access  Private/Admin
 * @param {Express.Request} req - The request object, expects a file and form fields.
 * @param {Express.Response} res - The response object.
 */
router.post('/getAdminDashboard', auth, async (req, res) => {
    try {
        const { DashboardId } = req.body;
        if (!DashboardId) {
            return res.status(400).json({ message: 'Dashboard ID is required' });
        }
        const userId = req.user._id || req.user.id;
        if (!userId) {
            return res.status(400).json({ message: 'User ID is missing' });
        }
        const userIdStr = userId.toString();

        const adminDashboard = await AdminDashboard.findOne({ linkCode: DashboardId });
        if (!adminDashboard) return res.status(404).json({ message: 'Admin dashboard not found' });

        // extract the actual userId values
        const adminIds = adminDashboard.admins.map((a) => a.userId.toString());
        const isAdmin = adminIds.includes(userIdStr);
        if (!isAdmin) return res.status(403).json({ message: 'Access denied' });

        const DashboardToSend = {
            dashboardName: adminDashboard.dashboardName,
            createdAt: adminDashboard.createdAt,
            users: adminDashboard.users,
            quizzes: adminDashboard.quizzes,
            leaderBoard: adminDashboard.leaderBoard,
        };

        res.status(200).json(DashboardToSend);
    } catch (error) {
        console.error('Error fetching admin dashboard:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
