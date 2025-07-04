import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
    {
        username: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        passwordHash: { type: String },
        avatarUrl: String,

        // Add these new fields for email OTP verification
        emailVerified: {
            type: Boolean,
            default: false,
        },

        emailVerificationCode: {
            type: String,
        },

        emailVerificationExpires: {
            type: Date,
        },

        gender: {
            type: String,
            enum: ['Male', 'Female', 'Other'],
        },
        dob: { type: Date },
        contact_no: { type: String },
        languages: {
            type: [String],
            enum: ['English', 'Hindi', 'Marathi'],
            default: ['English'],
        },
        xp: { type: Number, default: 0 },
        gems:{type:Number, default:0},
        currentStreak: { type: Number, default: 0 },
        longestStreak: { type: Number, default: 0 },
        lastLoginDate: { type: Date },
        achievements: [String],
        
        // Add friends field that was missing
        friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

        surveyFilled: { type: Boolean, default: false },
        syllabus: {
            type: [String],
            enum: ['JEE', 'NEET', 'KJSCE', 'MU'],
            default: [],
        },
        language: { type: String },
        dob: { type: Date },
        phoneNumber: { type: String },

        currentSubscription: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Subscription',
            default: null,
        },

        stripeCustomerId: { type: String, default: null },
        stripeSubscriptionId: { type: String, default: null },

        // For password reset
        resetPasswordToken: { type: String },
        resetPasswordExpires: { type: Date },
    },
    { timestamps: true }
);

const User = mongoose.model('User', UserSchema);
export default User;
