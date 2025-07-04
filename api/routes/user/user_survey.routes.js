import express from 'express';
import UserSurvey from '../../models/survey/user_survey.model.js';
import mongoose from 'mongoose';

const router = express.Router();

// POST survey submission (no authentication required)
router.post('/', async (req, res) => {
    try {
        const { source, dailyTimeCommitment, knowledgeLevel, userId } = req.body;

        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'A valid User ID is required.' });
        }

        const existing = await UserSurvey.findOne({ user: userId });
        if (existing) {
            return res.status(400).json({ message: 'Survey already submitted.' });
        }

        if (!knowledgeLevel || knowledgeLevel < 1 || knowledgeLevel > 10) {
            return res.status(400).json({ message: 'Knowledge Level must be between 1 and 10.' });
        }

        // Validate source against valid enum values
        const validSources = ['instagram', 'facebook', 'friend', 'school', 'youtube', 'google', 'other', 'tv', 'news'];
        if (!validSources.includes(source)) {
            return res.status(400).json({ 
                message: 'Invalid source value.', 
                received: source,
                validValues: validSources 
            });
        }

        // Validate time commitment against valid enum values
        const validTimeCommitments = ['30-60 mins', '1-3 hours', '3-5 hours', '>5 hours'];
        if (!validTimeCommitments.includes(dailyTimeCommitment)) {
            return res.status(400).json({ 
                message: 'Invalid time commitment value.', 
                received: dailyTimeCommitment,
                validValues: validTimeCommitments 
            });
        }

        // Create and save the new survey
        const newSurvey = new UserSurvey({
            user: userId,
            source,
            dailyTimeCommitment,
            knowledgeLevel,
        });

        await newSurvey.save();

        // 🔄 Update the User to mark survey as filled
        const User = (await import('../../models/auth/User.model.js')).default;
        await User.findByIdAndUpdate(userId, { surveyFilled: true });

        res.status(201).json(newSurvey);
    } catch (err) {
        console.error('Error creating survey:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});


export default router;
