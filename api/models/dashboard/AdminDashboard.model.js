import mongoose from 'mongoose';
import { title } from 'process';
const { Schema } = mongoose;

const AdminDashboardSchema = new mongoose.Schema({
    users: [
        {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            name: String,
            email: String,
            avatarUrl: String,
            xp: { type: Number, default: 0 },
            streak: { type: Number, default: 0 },
            achievements: [String],
        },
    ],
    linkCode: {
        type: String,
        required: false,
        unique: true,
    },
    passwordHash: String,
    admins: [
        {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        },
    ],
    quizzes: [
        {
            quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
            title: String,
            syllabus: { type: String, enum: ['JEE', 'NEET', 'KJSCE'] },
            subject: String,
        },
    ],
    leaderBoard: [
        {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            score: Number,
        },
    ],
    createdAt: {
        type: Date,
        default: Date.now,
    },
    dashboardName: {
        type: String,
        required: true,
    },
    report: [
        //TODO: figure out reports
        {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
            description: String,
            createdAt: {
                type: Date,
                default: Date.now,
            },
        },
    ],
});

const AdminDashboard = mongoose.model('AdminDashboard', AdminDashboardSchema);
export default AdminDashboard;
