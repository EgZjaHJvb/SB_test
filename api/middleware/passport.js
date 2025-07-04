import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/auth/User.model.js';

dotenv.config();

// Local Strategy - Email and Password
passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
        try {
            const user = await User.findOne({ email });
            if (!user) return done(null, false, { message: 'Incorrect email.' });

            const isMatch = await bcrypt.compare(password, user.passwordHash);
            if (!isMatch) return done(null, false, { message: 'Incorrect password.' });

            // You can update lastLoginDate here or other login-related info if you want
            user.lastLoginDate = new Date();
            await user.save();

            return done(null, user);
        } catch (err) {
            return done(err);
        }
    })
);

// Google OAuth Strategy
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_OAUTH_CALLBACK_URL || '/api/v1/auth/google/callback',
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails[0].value;
                let user = await User.findOne({ email });

                if (!user) {
                    // Create new user
                    let username = profile.displayName;
                    let usernameExists = await User.findOne({ username });
                    let counter = 1;
                    while (usernameExists) {
                        username = `${profile.displayName}_${counter}`;
                        usernameExists = await User.findOne({ username });
                        counter++;
                    }

                    user = new User({
                        username,
                        email,
                        googleId: profile.id,
                        avatarUrl: profile.photos[0]?.value || '',
                        currentStreak: 0,
                        longestStreak: 0,
                        xp: 0,
                        surveyFilled: false,
                        emailVerified: true, // Google users are pre-verified
                        followers: [],
                        following: [],
                        friends: []
                    });

                    await user.save();
                } else {
                    // Update googleId or avatar if missing
                    if (!user.googleId) {
                        user.googleId = profile.id;
                    }
                    if (!user.avatarUrl && profile.photos[0]?.value) {
                        user.avatarUrl = profile.photos[0].value;
                    }
                    await user.save();
                }

                return done(null, user);
            } catch (err) {
                console.error('Google OAuth Strategy Error:', err);
                return done(err, null);
            }
        }
    )
);

// Serialize and deserialize for session (if using session)
passport.serializeUser((user, done) => {
    done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

export default passport;
