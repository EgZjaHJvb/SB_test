/**
 * Main entry point for Quizitt API server.
 * Connects to MongoDB (Redis disabled), then starts the Express server.
 * @module index
 */

import app from './app.js';
import run from './db/db.js';
import { connectRedis } from './db/redis.js';

const PORT = process.env.PORT || 3000;

Promise.all([
    run(), // connect to MongoDB
    connectRedis(), // connect to Redis
])
    .then(() => {
        console.log('Connected to MongoDB and Redis');
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Failed to connect to database:', err);
    });

process.removeAllListeners('warning'); // Remove default warning listeners
