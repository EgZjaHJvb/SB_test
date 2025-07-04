import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import passport from './middleware/passport.js';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';


dotenv.config();
const app = express();

// For __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORS Configuration
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'http://localhost:5173', // Vite dev server
            'http://localhost:3000', // Alternative dev server
            'http://localhost:4173', // Vite preview server
            'https://deploying-quizitt.vercel.app', // Production frontend
           ' http://localhost:8000',
            'https://deploying-quizitt.onrender.com', // Production backend (for internal requests)
            process.env.FRONTEND_URL, // Environment variable override
            process.env.CROSS_ORIGIN, // Environment variable override
        ].filter(Boolean); // Remove undefined values
        
        // Check if origin is in allowed list or is a Vercel preview deployment
        if (allowedOrigins.includes(origin) || 
            (origin && origin.includes('deploying-quizitt') && origin.includes('vercel.app')) ||
            (origin && origin.includes('vercel.app'))) {
            callback(null, true);
        } else {
            console.warn(`CORS: Blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true, // Allow cookies to be sent
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with'],
    optionsSuccessStatus: 200, // For legacy browser support
    preflightContinue: false
};

// Middleware
app.use(morgan('dev'));
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

// Serve PCB Podcast folder as static files at /media/podcast
app.use('/media/podcast', express.static(path.join(__dirname, 'PCB Podcast')));

// Routes
import authRoutes from './routes/auth/auth.routes.js';
import quizRoutes from './routes/quiz/quiz.routes.js';
app.use('/api/v1/quiz', quizRoutes);

// Material
import materialRoutes from './routes/material/material.route.js';
app.use('/api/v1/material', materialRoutes);

import adminDashboardRoutes from './routes/dashboard/adminDashboard.routes.js';
import communityRoutes from './routes/community/community.routes.js';
import summaryRoutes from './routes/quiz/summary.routes.js';
import aiRoutes from './routes/community/ai.routes.js';
import userRoutes from './routes/user/user.routes.js';
import userSurveyRoutes from './routes/user/user_survey.routes.js';
import friendRoutes from './routes/community/friend.routes.js';
import quizAttemptRoutes from './routes/quiz/quiz_attempt.route.js';
import subscriptionRoutes from './routes/subscription/subscription.route.js';
import featuresRoutes from './routes/subscription/features.route.js';
import nsfwRoutes from './routes/nsfwRoutes.js';
import podcastRoutes from './routes/upload/uploadRoutes.js'

// Mount routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/quiz', quizRoutes);
app.use('/api/v1/admin', adminDashboardRoutes);
app.use('/api/v1/community', communityRoutes);
app.use('/api/v1/summary', summaryRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/survey', userSurveyRoutes);
app.use('/api/v1/friend', friendRoutes);
app.use('/api/v1/quiz-attempt', quizAttemptRoutes);
app.use('/api/v1/podcasts', podcastRoutes);
// Subscription routes with versioning prefix
app.use('/api/v1/subscription', subscriptionRoutes);

app.use('/api/v1/subscription/features', featuresRoutes);

// Quiz Streak
import quizStreakRoutes from './routes/quiz/quiz_streak.route.js';
app.use('/api/v1/quiz-streak', quizStreakRoutes);

// Total Quiz
import quizStatRoutes from './routes/quiz/quiz_stats.route.js';
app.use('/api/v1/quiz-stat', quizStatRoutes);

// Time Each Day Monthly
import getMonthlyStudyTime from './routes/quiz/total_time.route.js';
app.use('/api/v1/monthly-time', getMonthlyStudyTime);

// Monthly average time

import getMonthlyAveragetime from './routes/quiz/monthly_average_time.route.js';
app.use('/api/v1/monthly-average-time', getMonthlyAveragetime);

// User score
import quizScoreRoutes from './routes/quiz/quizScore.route.js';
app.use('/api/v1/score', quizScoreRoutes);

// AI Quiz Score
import aiQuizScoreRoutes from './routes/quiz/aiQuizScore.routes.js';
app.use('/api/v1/ai-quiz-score', aiQuizScoreRoutes);
app.use('/api/v1/ai-score', aiQuizScoreRoutes);
// Add this for compatibility with frontend expecting /api/v1/aiQuizScore
app.use('/api/v1/aiQuizScore', aiQuizScoreRoutes);

// delete the user
import deleteUserRoutes from './routes/user/delete.route.js';
app.use('/api/v1/auth/delete', deleteUserRoutes);

//detection
app.use('/api/v1/nsfw', nsfwRoutes);

// Quizzes for Dashboard
import PhysicsQuizRoutes from './routes/quiz/physics/physics.routes.js';
app.use('/api/v1/phy-pathway', PhysicsQuizRoutes);

import BiologyQuizRoutes from './routes/quiz/biology/biology.routes.js';
app.use('/api/v1/bio-pathway', BiologyQuizRoutes);

import ChemistryQuizRoutes from './routes/quiz/chemistry/chemistry.routes.js';
app.use('/api/v1/chem-pathway', ChemistryQuizRoutes);

import MathsQuizRoutes from './routes/quiz/maths/maths.routes.js';
app.use('/api/v1/math-pathway', MathsQuizRoutes);

import VLSIQuizRoutes from './routes/quiz/vlsi/vlsi.routes.js';
app.use('/api/v1/vlsi-pathway', VLSIQuizRoutes);

import userPathway from './routes/generate/userPathway.routes.js';
app.use('/api/v1/userPathway', userPathway);

import userProgressRoutes from './routes/quiz/userPathway.routes.js'
app.use('/api/v1/progress', userProgressRoutes);


import flashcards from './routes/quiz/physics/flashcard.route.js'
app.use('/api/v1', flashcards);

import gems from './routes/user/gems.route.js'
app.use('/api/v1/gems',gems);
// //
// import materialRoutes from './routes/material/material.route.js';
// app.use('/api/v1/material', materialRoutes);


// import podcastRoutes from './routes/material/podcast.route.js';
// app.use('/api/v1/podcasts', podcastRoutes);

export default app;
