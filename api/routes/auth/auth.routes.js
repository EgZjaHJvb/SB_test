import express from 'express';
import passport from '../../middleware/passport.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../../models/auth/User.model.js';
import auth from '../../middleware/auth.js';
import { sendVerificationEmail } from '../../utils/sendVerificationEmail.js';
import crypto from 'crypto'; // For generating OTP
import nodemailer from 'nodemailer';
import { logout } from '../../controllers/user/user.controller.js';
import { sendPasswordResetEmail } from '../../utils/sendVerificationEmail.js';

// import protect from '../../middleware/auth.js'; // Note the .js extension

const router = express.Router();

/**
 * Registers a new user.
 * @route POST /auth/register
 * @access Public
 * @param {Express.Request} req - The request object, expects username, email, password, syllabus.
 * @param {Express.Response} res - The response object.
 */

router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: 'Email already registered' });

        const passwordHash = await bcrypt.hash(password, 10);

        // ✅ Generate OTP
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const verificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        const user = new User({
            username,
            email,
            passwordHash,
            surveyFilled: false,
            emailVerified: false, // default value
            emailVerificationCode: verificationCode,
            emailVerificationExpires: verificationExpires,
        });

        await user.save();

        // ✅ Send OTP email
        await sendVerificationEmail(email, verificationCode);

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
            expiresIn: '7d',
        });

        res.status(201).json({
            message: 'User registered successfully. OTP sent to email.',
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                hasFilledSurvey: user.hasFilledSurvey,
                surveyFilled: user.surveyFilled,
                avatarUrl: user.avatarUrl,
            },
            token,
        });
    } catch (err) {
        console.error('Registration error:', err.message);
        res.status(500).json({ message: 'Something went wrong during registration' });
    }
});

// Email verification (OTP) endpoint
router.post('/verify-email', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid email or OTP' });
        }
        if (
            user.emailVerificationCode !== otp ||
            !user.emailVerificationExpires ||
            user.emailVerificationExpires < new Date()
        ) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }
        user.emailVerified = true;
        user.emailVerificationCode = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();
        return res.status(200).json({ message: 'Email verified successfully' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error during email verification' });
    }
});

/**
 * Logs in a user with local strategy.
 * @route POST /auth/login
 * @access Public
 * @param {Express.Request} req - The request object, expects email and password.
 * @param {Express.Response} res - The response object.
 */

router.post('/login', (req, res, next) => {
    passport.authenticate('local', { session: false }, async (err, user, info) => {
        if (err) return res.status(500).json({ message: 'Server error.' });
        if (!user) return res.status(401).json({ message: info.message });

        // 🚩 Email verification check
        if (!user.emailVerified) {
            return res.status(403).json({ message: 'Please verify your email before logging in.' });
        }

        try {
            const today = new Date();
            const lastLoginDate = user.lastLoginDate ? new Date(user.lastLoginDate) : null;

            if (!lastLoginDate) {
                user.currentStreak = 1;
                user.longestStreak = 1;
            } else {
                const diffInDays = Math.floor((today - lastLoginDate) / (1000 * 60 * 60 * 24));
                if (diffInDays === 1) {
                    user.currentStreak += 1;
                    if (user.currentStreak > user.longestStreak) {
                        user.longestStreak = user.currentStreak;
                    }
                } else if (diffInDays > 1) {
                    user.currentStreak = 1;
                }
            }

            user.lastLoginDate = today;
            await user.save();

 
            const fullUser = await User.findById(user._id).lean();

            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

            const cookieOptions = {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production', // Only use secure in production
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for cross-origin in production
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
                domain: process.env.NODE_ENV === 'production' ? undefined : undefined, // Let browser handle domain
            };

            res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });

            return res.json({
                token,
                user: {
                    id: fullUser._id,
                    username: fullUser.username,
                    email: fullUser.email,
                    avatarUrl: fullUser.avatarUrl || '',
                    currentStreak: fullUser.currentStreak || 0,
                    longestStreak: fullUser.longestStreak || 0,
                    surveyFilled: fullUser.surveyFilled || false,
                    syllabus: fullUser.syllabus || [],
                    currentSubscription: fullUser.currentSubscription || null,
                    emailVerified: fullUser.emailVerified || false,
                },
            });
        } catch (updateError) {
            return res.status(500).json({ message: 'Error updating streak data.' });
        }
    })(req, res, next);
});

/**
 * Change user password.
 * @route PUT /auth/change-password
 * @access Private
 * @param {Express.Request} req - The request object, expects currentPassword and newPassword.
 * @param {Express.Response} res - The response object.
 */
router.put('/change-password', auth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id; // Assuming `auth` middleware adds user info from JWT

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Please provide both current and new passwords' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if current password is correct
        const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        // Hash the new password
        const passwordHash = await bcrypt.hash(newPassword, 10);

        // Update the user's password in the database
        user.passwordHash = passwordHash;
        await user.save();

        res.status(200).json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * Gets the current authenticated user.
 * @route GET /auth/me
 * @access Private
 * @param {Express.Request} req - The request object.
 * @param {Express.Response} res - The response object.
 */
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).lean();
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                avatarUrl: user.avatarUrl || '',
                currentStreak: user.currentStreak || 0,
                longestStreak: user.longestStreak || 0,
                surveyFilled: user.surveyFilled || false,
                syllabus: user.syllabus || [],
                currentSubscription: user.currentSubscription || null,
                emailVerified: user.emailVerified || false,
            },
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * Logs out the current user by clearing the token cookie.
 * @route POST /auth/logout
 * @access Private
 * @param {Express.Request} req - The request object.
 * @param {Express.Response} res - The response object.
 */
router.post('/logout', logout);

/**
 * Initiates Google OAuth login.
 * @route GET /auth/google
 * @access Public
 */
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

/**
 * Handles Google OAuth callback and returns JWT token.
 * @route GET /auth/google/callback
 * @access Public
 * @param {Express.Request} req - The request object.
 * @param {Express.Response} res - The response object.
 */
router.get(
    '/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/login' }),
    async (req, res) => {
        try {
            const user = req.user;

            if (!user) {
                return res.status(400).send(`
                    <html>
                        <body>
                            <script>
                                if (window.opener) {
                                    window.opener.postMessage({
                                        error: 'Authentication failed'
                                    }, '*');
                                }
                                window.close();
                            </script>
                        </body>
                    </html>
                `);
            }

            // Update streak on successful Google login
            try {
                const today = new Date();
                const lastLoginDate = user.lastLoginDate ? new Date(user.lastLoginDate) : null;

                if (!lastLoginDate) {
                    // First login ever
                    user.currentStreak = 1;
                    user.longestStreak = 1;
                } else {
                    // Get difference in days
                    const diffInDays = Math.floor((today - lastLoginDate) / (1000 * 60 * 60 * 24));

                    if (diffInDays === 0) {
                        // Same day login, don't change streak
                    } else if (diffInDays === 1) {
                        // Next day login, increment streak
                        user.currentStreak += 1;
                        if (user.currentStreak > user.longestStreak) {
                            user.longestStreak = user.currentStreak;
                        }
                    } else {
                        // More than one day gap, reset streak
                        user.currentStreak = 1;
                    }
                }

                user.lastLoginDate = today;
                await user.save();
            } catch (err) {
                console.error('Error updating streak for Google user:', err);
                // Continue with login even if streak update fails
            }

            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

            // Set token in cookie (same as regular login)
            const cookieOptions = {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
                domain: process.env.NODE_ENV === 'production' ? undefined : undefined,
            };

            res.cookie('token', token, cookieOptions);

            const userData = {
                id: user._id.toString(),
                username: user.username,
                email: user.email,
                avatarUrl: user.avatarUrl || '',
                currentStreak: user.currentStreak || 0,
                longestStreak: user.longestStreak || 0,
                xp: user.xp || 0,
                syllabus: user.syllabus || [],
                achievements: user.achievements || [],
                friends: user.friends || [],
                surveyFilled: user.surveyFilled || false,
            };

            // Send token and complete user info via postMessage (for OAuth popup flow)
            return res.send(`
                <html>
                    <body>
                        <script>
                            if (window.opener) {
                                window.opener.postMessage({
                                    token: '${token}',
                                    user: ${JSON.stringify(userData)}
                                }, '*');
                                setTimeout(() => window.close(), 1000);
                            } else {
                                document.body.innerHTML = '<p>Login successful! You can close this window.</p>';
                            }
                        </script>
                    </body>
                </html>
            `);
        } catch (error) {
            console.error('Google callback error:', error);
            return res.status(500).send(`
                <html>
                    <body>
                        <script>
                            if (window.opener) {
                                window.opener.postMessage({
                                    error: 'Internal server error during authentication'
                                }, '*');
                            }
                            window.close();
                        </script>
                    </body>
                </html>
            `);
        }
    }
);

/**
 * Updates the user's syllabus and optional profile info.
 * @route PATCH /auth/syllabus
 * @access Private
 * @param {Array<string>} syllabus - One or more of ['JEE', 'NEET', 'KJSCE', 'MU']
 * @param {string} language - Optional language preference
 * @param {Date} dob - Optional date of birth
 * @param {string} phoneNumber - Optional phone number
 */
router.patch('/syllabus', auth, async (req, res) => {
    let { syllabus, language, dob, phoneNumber } = req.body;

    const validSyllabi = ['JEE', 'NEET', 'KJSCE', 'MU'];

    // Ensure syllabus is an array
    if (!Array.isArray(syllabus)) {
        syllabus = syllabus ? [syllabus] : [];
    }

    // Check for invalid syllabus values
    const invalidEntries = syllabus.filter((s) => !validSyllabi.includes(s));
    if (invalidEntries.length > 0) {
        return res
            .status(400)
            .json({ message: 'Invalid syllabus option(s): ' + invalidEntries.join(', ') });
    }

    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        // Replace the user's syllabus array with the new one
        user.syllabus = syllabus;

        if (language) user.language = language;
        if (dob) user.dob = new Date(dob);
        if (phoneNumber) user.phoneNumber = phoneNumber;

        user.surveyFilled = true;

        await user.save();

        return res.json({
            message: 'Syllabus and profile information updated successfully.',
            user: user.toObject({ versionKey: false }),
        });
    } catch (err) {
        console.error('Error updating syllabus:', err);
        return res.status(500).json({ message: 'Server error while updating user.' });
    }
});

// Get all users (for friend search) with follower/following counts
router.get('/users', auth, async (req, res) => {
    try {
        const currentUserId = req.user.id;
        
        const users = await User.find(
            { 
                _id: { $ne: currentUserId }, // Exclude current user
                username: { $exists: true, $ne: null }
            },
            '_id username avatarUrl followers following xp streak syllabus createdAt'
        )
            .sort({ createdAt: -1 }) // Show newest users first
            .limit(200)
            .lean();

        const usersWithCounts = users.map((user) => ({
            _id: user._id,
            username: user.username,
            avatarUrl: user.avatarUrl,
            followerCount: user.followers?.length || 0,
            followingCount: user.following?.length || 0,
            xp: user.xp || 0,
            streak: user.streak || 0,
            syllabus: user.syllabus || [],
            createdAt: user.createdAt
        }));

        res.json({ users: usersWithCounts });
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ message: 'Server error fetching users.' });
    }
});

/**
 * Updates the user's avatar URL after Cloudinary upload.
 * @route PATCH /auth/avatar
 * @access Private
 * @param {string} avatarUrl - The Cloudinary URL of the uploaded avatar.
 */
router.patch('/avatar', auth, async (req, res) => {
    const { avatarUrl } = req.body;

    if (!avatarUrl) {
        return res.status(400).json({ message: 'Avatar URL is required.' });
    }

    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        user.avatarUrl = avatarUrl;
        await user.save();

        return res.json({
            message: 'Avatar updated successfully.',
            avatarUrl: user.avatarUrl,
        });
    } catch (err) {
        console.error('Error updating avatar:', err);
        res.status(500).json({ message: 'Server error while updating avatar.' });
    }
});

/**
 * Get syllabus and user ID of current authenticated user.
 * @route GET /auth/syllabus
 * @access Private
 */
router.get('/syllabus', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).lean();
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ userId: user._id, syllabus: user.syllabus || [] });
    } catch (error) {
        console.error('Error fetching syllabus:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * Gets the current authenticated user profile.
 * @route GET /auth/profile
 * @access Private
 */
router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-passwordHash');
        if (!user) return res.status(404).json({ message: 'User not found.' });
        res.json({ user });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
});

router.get('/profiles', auth, async (req, res) => {
    try {
        // Select only the necessary fields: username, avatarUrl, dob, contact_no, email
        const user = await User.findById(req.user.id).select(
            'username avatarUrl dob contact_no email'
        );
        if (!user) return res.status(404).json({ message: 'User not found.' });
        res.json({ user });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
});

/**
 * Updates the user's username (unique).
 * @route PATCH /auth/v1/username
 * @access Private
 * @param {string} username - The new username.
 */
router.patch('/username', auth, async (req, res) => {
    const { username } = req.body;

    // Basic validation
    if (!username || typeof username !== 'string' || username.trim().length < 3) {
        return res
            .status(400)
            .json({ message: 'Invalid username. Must be at least 3 characters.' });
    }

    try {
        const trimmedUsername = username.trim();

        // Check if the username is already taken (excluding self)
        const existingUser = await User.findOne({ username: trimmedUsername });
        if (existingUser && existingUser._id.toString() !== req.user.id) {
            return res.status(409).json({ message: 'Username is already taken.' });
        }

        // Update username
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        user.username = trimmedUsername;
        await user.save();

        return res.json({
            message: 'Username updated successfully.',
            username: user.username,
        });
    } catch (err) {
        console.error('Error updating username:', err);
        res.status(500).json({ message: 'Server error while updating username.' });
    }
});

/**
 * Updates the user's gender.
 * @route PATCH /auth/gender
 * @access Private
 * @param {string} gender - The selected gender ('Male', 'Female', 'Other').
 */
router.patch('/gender', auth, async (req, res) => {
    const { gender } = req.body;

    const validGenders = ['Male', 'Female', 'Other'];
    if (!validGenders.includes(gender)) {
        return res.status(400).json({ message: 'Invalid gender value.' });
    }

    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        user.gender = gender;
        await user.save();

        return res.json({
            message: 'Gender updated successfully.',
            gender: user.gender,
        });
    } catch (err) {
        console.error('Error updating gender:', err);
        res.status(500).json({ message: 'Server error while updating gender.' });
    }
});

// Forgot Password Endpoint
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }
    try {
        const user = await User.findOne({ email });
        if (!user) {
            // Always respond with success to prevent email enumeration
            return res
                .status(200)
                .json({ message: 'If this email is registered, a reset link has been sent.' });
        }
        // Generate token
        const token = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
        await user.save();
        // Build reset link
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetLink = `${frontendUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
        // Send email
        await sendPasswordResetEmail(email, resetLink);
        return res
            .status(200)
            .json({ message: 'If this email is registered, a reset link has been sent.' });
    } catch (err) {
        console.error('Forgot password error:', err);
        return res.status(500).json({ message: 'Server error. Please try again.' });
    }
});

// Reset Password Endpoint
router.post('/reset-password', async (req, res) => {
    const { token, email, password } = req.body;
    if (!token || !email || !password) {
        return res.status(400).json({ message: 'Missing required fields.' });
    }
    try {
        const user = await User.findOne({
            email,
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() },
        });
        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired token.' });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        user.passwordHash = passwordHash;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        res.status(200).json({ message: 'Password has been reset. You can now log in.' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ message: 'Server error. Please try again.' });
    }
});

export default router;
