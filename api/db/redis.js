import { createClient } from 'redis';

// /**
//  * Redis client instance and connection utility for Quizitt API.
//  * @module db/redis
//  */

const client = createClient({
    url: process.env.REDIS_URL,
});

client.on('error', (err) => console.log('Redis Client Error', err));

// /**
//  * Connects to the Redis server using the provided REDIS_URL.
//  * @returns {Promise<void>} Resolves when connected.
//  */
export const connectRedis = async () => {
    await client.connect();
    console.log('Connected to Redis');
};

// export default client;
export default client;
