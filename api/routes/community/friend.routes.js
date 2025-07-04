import express from 'express';
import Friend from '../../models/community/Friends.model.js';
import User from '../../models/auth/User.model.js';
import auth from '../../middleware/auth.js';
import mongoose from 'mongoose';

const router = express.Router();

/**
 * Sends a friend request to another user.
 * @route POST /friends/request
 * @access Private
 * @param {Express.Request} req - The request object, expects recipientId and optional message.
 * @param {Express.Response} res - The response object.
 */
router.post('/request', auth, async (req, res) => {
    try {
        const { recipientId, message } = req.body;
        const requesterId = req.user.id;

        if (!recipientId) {
            return res.status(400).json({ message: 'Recipient ID is required.' });
        }

        if (!mongoose.Types.ObjectId.isValid(recipientId)) {
            return res.status(400).json({ message: 'Invalid recipient ID.' });
        }

        // Check if recipient exists
        const recipient = await User.findById(recipientId);
        if (!recipient) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Prevent self-friending
        if (requesterId === recipientId) {
            return res.status(400).json({ message: 'Cannot send friend request to yourself.' });
        }

        // Check if friendship already exists
        const existingFriendship = await Friend.findOne({
            $or: [
                { requester: requesterId, recipient: recipientId },
                { requester: recipientId, recipient: requesterId },
            ],
        });

        if (existingFriendship) {
            if (existingFriendship.status === 'accepted') {
                return res.status(409).json({ message: 'You are already friends.' });
            } else if (existingFriendship.status === 'pending') {
                return res.status(409).json({ message: 'Friend request already pending.' });
            } else if (existingFriendship.status === 'blocked') {
                return res.status(403).json({ message: 'Cannot send friend request.' });
            }
        }

        // Create friend request
        const friendRequest = await Friend.create({
            requester: requesterId,
            recipient: recipientId,
            message: message || '',
        });

        await friendRequest.populate('recipient', 'username avatarUrl');

        return res.status(201).json({
            message: 'Friend request sent successfully.',
            friendRequest,
        });
    } catch (err) {
        return res.status(500).json({ message: 'Server error.' });
    }
});

/**
 * Accepts a friend request.
 * @route PUT /friends/accept/:requestId
 * @access Private
 * @param {Express.Request} req - The request object with requestId param.
 * @param {Express.Response} res - The response object.
 */
router.put('/accept/:requestId', auth, async (req, res) => {
    try {
        const { requestId } = req.params;
        const userId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ message: 'Invalid request ID.' });
        }

        const friendRequest = await Friend.findOneAndUpdate(
            {
                _id: requestId,
                recipient: userId,
                status: 'pending',
            },
            {
                status: 'accepted',
                respondedAt: new Date(),
            },
            { new: true }
        ).populate([
            { path: 'requester', select: 'username avatarUrl' },
            { path: 'recipient', select: 'username avatarUrl' },
        ]);

        if (!friendRequest) {
            return res
                .status(404)
                .json({ message: 'Friend request not found or already processed.' });
        }

        // Add each other to friends array
        await Promise.all([
            User.findByIdAndUpdate(friendRequest.requester._id, {
                $addToSet: { friends: friendRequest.recipient._id },
            }),
            User.findByIdAndUpdate(friendRequest.recipient._id, {
                $addToSet: { friends: friendRequest.requester._id },
            }),
        ]);

        return res.json({
            message: 'Friend request accepted.',
            friendship: friendRequest,
        });
    } catch (err) {
        return res.status(500).json({ message: 'Server error.' });
    }
});

/**
 * Declines a friend request.
 * @route PUT /friends/decline/:requestId
 * @access Private
 * @param {Express.Request} req - The request object with requestId param.
 * @param {Express.Response} res - The response object.
 */
router.put('/decline/:requestId', auth, async (req, res) => {
    try {
        const { requestId } = req.params;
        const userId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ message: 'Invalid request ID.' });
        }

        const friendRequest = await Friend.findOneAndUpdate(
            {
                _id: requestId,
                recipient: userId,
                status: 'pending',
            },
            {
                status: 'declined',
                respondedAt: new Date(),
            },
            { new: true }
        );

        if (!friendRequest) {
            return res
                .status(404)
                .json({ message: 'Friend request not found or already processed.' });
        }

        return res.json({ message: 'Friend request declined.' });
    } catch (err) {
        return res.status(500).json({ message: 'Server error.' });
    }
});

/**
 * Get pending friend requests (incoming) and accepted friends.
 * @route GET /friends/status
 * @access Private
 */
router.get('/status', auth, async (req, res) => {
    try {
        const userId = req.user.id;

        // Incoming friend requests where the user is the recipient
        const pendingRequests = await Friend.find({
            recipient: userId,
            status: 'pending',
        }).populate({
            path: 'requester',
            select: 'username avatarUrl',
        });

        // Accepted friendships
        const acceptedFriendships = await Friend.find({
            $or: [{ requester: userId }, { recipient: userId }],
            status: 'accepted',
        }).populate([
            { path: 'requester', select: 'username avatarUrl' },
            { path: 'recipient', select: 'username avatarUrl' },
        ]);

        const friends = acceptedFriendships.map((friendship) => {
            const friend =
                friendship.requester._id.toString() === userId
                    ? friendship.recipient
                    : friendship.requester;

            return {
                _id: friend._id,
                username: friend.username,
                avatarUrl: friend.avatarUrl,
            };
        });

        return res.json({
            friends,
            requests: pendingRequests.map((req) => ({
                _id: req._id,
                message: req.message,
                requester: {
                    _id: req.requester._id,
                    username: req.requester.username,
                    avatarUrl: req.requester.avatarUrl,
                },
            })),
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error.' });
    }
});


/**
 * Gets all friends with their stats.
 * @route GET /friends
 * @access Private
 * @param {Express.Request} req - The request object.
 * @param {Express.Response} res - The response object.
 */
router.get('/allrequests', auth, async (req, res) => {
    try {
        const userId = req.user.id;

        const friendships = await Friend.find({
            $and: [
                {
                    $or: [{ requester: userId }, { recipient: userId }],
                },
                { status: 'accepted' },
            ],
        })
            .populate([
                { path: 'requester', select: 'username avatarUrl xp streak achievements syllabus' },
                { path: 'recipient', select: 'username avatarUrl xp streak achievements syllabus' },
            ])
            .sort({ respondedAt: -1 });

        // Transform to get friend data with stats
        const friends = friendships.map((friendship) => {
            const friend =
                friendship.requester._id.toString() === userId
                    ? friendship.recipient
                    : friendship.requester;

            return {
                friendshipId: friendship._id,
                friend: {
                    id: friend._id,
                    username: friend.username,
                    avatarUrl: friend.avatarUrl,
                    xp: friend.xp,
                    streak: friend.streak,
                    achievements: friend.achievements,
                    syllabus: friend.syllabus,
                },
                friendsSince: friendship.respondedAt,
            };
        });

        return res.json({
            friends,
            totalFriends: friends.length,
        });
    } catch (err) {
        return res.status(500).json({ message: 'Server error.' });
    }
});

/**
 * Gets friends leaderboard sorted by XP.
 * @route GET /friends/leaderboard
 * @access Private
 * @param {Express.Request} req - The request object.
 * @param {Express.Response} res - The response object.
 */
router.get('/leaderboard', auth, async (req, res) => {
    try {
        const userId = req.user.id;

        // Get current user
        const currentUser = await User.findById(userId).select(
            'username avatarUrl xp streak syllabus'
        );
        if (!currentUser) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const friendships = await Friend.find({
            $and: [
                {
                    $or: [{ requester: userId }, { recipient: userId }],
                },
                { status: 'accepted' },
            ],
        }).populate([
            { path: 'requester', select: 'username avatarUrl xp streak syllabus' },
            { path: 'recipient', select: 'username avatarUrl xp streak syllabus' },
        ]);

        // Get friends data
        const friendsData = friendships.map((friendship) => {
            const friend =
                friendship.requester._id.toString() === userId
                    ? friendship.recipient
                    : friendship.requester;

            return {
                id: friend._id,
                username: friend.username,
                avatarUrl: friend.avatarUrl,
                xp: friend.xp,
                streak: friend.streak,
                syllabus: friend.syllabus,
            };
        });

        // Add current user to leaderboard
        friendsData.push({
            id: currentUser._id,
            username: currentUser.username,
            avatarUrl: currentUser.avatarUrl,
            xp: currentUser.xp,
            streak: currentUser.streak,
            syllabus: currentUser.syllabus,
            isCurrentUser: true,
        });

        // Sort by XP descending and add ranks
        const leaderboard = friendsData
            .sort((a, b) => b.xp - a.xp)
            .map((user, index) => ({
                ...user,
                rank: index + 1,
            }));

        return res.json({
            leaderboard,
            currentUserRank: leaderboard.find((u) => u.isCurrentUser)?.rank,
        });
    } catch (err) {
        return res.status(500).json({ message: 'Server error.' });
    }
});

/**
 * Gets pending friend requests received by the user.
 * @route GET /friends/requests/received
 * @access Private
 * @param {Express.Request} req - The request object.
 * @param {Express.Response} res - The response object.
 */
router.get('/requests/received', auth, async (req, res) => {
    try {
        const userId = req.user.id;

        const pendingRequests = await Friend.find({
            recipient: userId,
            status: 'pending',
        })
            .populate('requester', 'username avatarUrl xp streak syllabus')
            .sort({ requestedAt: -1 });

        return res.json({
            requests: pendingRequests,
            totalRequests: pendingRequests.length,
        });
    } catch (err) {
        return res.status(500).json({ message: 'Server error.' });
    }
});

/**
 * Gets friend requests sent by the user.
 * @route GET /friends/requests/sent
 * @access Private
 * @param {Express.Request} req - The request object.
 * @param {Express.Response} res - The response object.
 */
router.get('/requests/sent', auth, async (req, res) => {
    try {
        const userId = req.user.id;

        const sentRequests = await Friend.find({
            requester: userId,
            status: 'pending',
        })
            .populate('recipient', 'username avatarUrl xp streak syllabus')
            .sort({ requestedAt: -1 });

        return res.json({
            requests: sentRequests,
            totalRequests: sentRequests.length,
        });
    } catch (err) {
        return res.status(500).json({ message: 'Server error.' });
    }
});

/**
 * Removes a friend.
 * @route DELETE /friends/:friendId
 * @access Private
 * @param {Express.Request} req - The request object with friendId param.
 * @param {Express.Response} res - The response object.
 */
router.delete('/:friendId', auth, async (req, res) => {
    try {
        const { friendId } = req.params;
        const userId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(friendId)) {
            return res.status(400).json({ message: 'Invalid friend ID.' });
        }

        // Remove friendship
        const removedFriendship = await Friend.findOneAndDelete({
            $and: [
                {
                    $or: [
                        { requester: userId, recipient: friendId },
                        { requester: friendId, recipient: userId },
                    ],
                },
                { status: 'accepted' },
            ],
        });

        if (!removedFriendship) {
            return res.status(404).json({ message: 'Friendship not found.' });
        }

        // Remove from each other's friends array
        await Promise.all([
            User.findByIdAndUpdate(userId, {
                $pull: { friends: friendId },
            }),
            User.findByIdAndUpdate(friendId, {
                $pull: { friends: userId },
            }),
        ]);

        return res.json({ message: 'Friend removed successfully.' });
    } catch (err) {
        return res.status(500).json({ message: 'Server error.' });
    }
});

/**
 * Searches users for sending friend requests.
 * @route GET /friends/search
 * @access Private
 * @param {Express.Request} req - The request object with query parameter.
 * @param {Express.Response} res - The response object.
 */
router.get('/search', auth, async (req, res) => {
    try {
        const { query } = req.query;
        const userId = req.user.id;

        if (!query || query.trim().length < 2) {
            return res.status(400).json({ message: 'Search query must be at least 2 characters.' });
        }

        // Search users by username or email
        const users = await User.find({
            _id: { $ne: userId }, // Exclude current user
            $or: [
                { username: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } },
            ],
        })
            .select('username email avatarUrl xp streak syllabus')
            .limit(20);

        // Check friendship status for each user
        const usersWithFriendshipStatus = await Promise.all(
            users.map(async (user) => {
                const friendship = await Friend.findOne({
                    $or: [
                        { requester: userId, recipient: user._id },
                        { requester: user._id, recipient: userId },
                    ],
                });

                return {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    avatarUrl: user.avatarUrl,
                    xp: user.xp,
                    streak: user.streak,
                    syllabus: user.syllabus,
                    friendshipStatus: friendship ? friendship.status : 'none',
                };
            })
        );

        return res.json({ users: usersWithFriendshipStatus });
    } catch (err) {
        return res.status(500).json({ message: 'Server error.' });
    }
});

// my changes
// routes/friends.js
router.post('/follow/:userId', auth, async (req, res) => {
    try {
        const requesterId = req.user.id;
        const recipientId = req.params.userId;

        if (!mongoose.Types.ObjectId.isValid(recipientId)) {
            return res.status(400).json({ message: 'Invalid user ID.' });
        }

        if (requesterId === recipientId) {
            return res.status(400).json({ message: 'You cannot follow yourself.' });
        }

        const recipient = await User.findById(recipientId);
        if (!recipient) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Update requester's following and recipient's followers
        await Promise.all([
            User.findByIdAndUpdate(requesterId, { $addToSet: { following: recipientId } }),
            User.findByIdAndUpdate(recipientId, { $addToSet: { followers: requesterId } }),
        ]);

        return res.status(200).json({ message: `You are now following ${recipient.username}.` });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error.' });
    }
});


// routes/friends.js
router.get('/following', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .populate('following', 'username avatarUrl');
        return res.status(200).json({ following: user.following });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error.' });
    }
});

router.get('/followers', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .populate('followers', 'username avatarUrl');
        return res.status(200).json({ followers: user.followers });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error.' });
    }
});

// Add unfollow endpoint
router.post('/unfollow/:userId', auth, async (req, res) => {
    try {
        const requesterId = req.user.id;
        const recipientId = req.params.userId;

        if (!mongoose.Types.ObjectId.isValid(recipientId)) {
            return res.status(400).json({ message: 'Invalid user ID.' });
        }

        if (requesterId === recipientId) {
            return res.status(400).json({ message: 'You cannot unfollow yourself.' });
        }

        const recipient = await User.findById(recipientId);
        if (!recipient) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Update requester's following and recipient's followers
        await Promise.all([
            User.findByIdAndUpdate(requesterId, { $pull: { following: recipientId } }),
            User.findByIdAndUpdate(recipientId, { $pull: { followers: requesterId } }),
        ]);

        return res.status(200).json({ message: `You have unfollowed ${recipient.username}.` });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error.' });
    }
});

// Update search endpoint to return more comprehensive data
router.get('/search-users', auth, async (req, res) => {
    try {
        const { query } = req.query;
        const userId = req.user.id;

        // If no query, return recent users
        const searchFilter = query && query.trim().length >= 2 ? {
            _id: { $ne: userId },
            $or: [
                { username: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } },
            ],
        } : {
            _id: { $ne: userId }
        };

        const users = await User.find(searchFilter)
            .select('username email avatarUrl xp streak syllabus followers following createdAt')
            .sort({ createdAt: -1 }) // Show newest users first
            .limit(50);

        // Add follower/following counts and relationship status
        const usersWithStatus = users.map(user => ({
            _id: user._id,
            username: user.username,
            email: user.email,
            avatarUrl: user.avatarUrl,
            xp: user.xp || 0,
            streak: user.streak || 0,
            syllabus: user.syllabus,
            followerCount: (user.followers || []).length,
            followingCount: (user.following || []).length,
            createdAt: user.createdAt
        }));

        return res.json({ users: usersWithStatus });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error.' });
    }
});

export default router;

