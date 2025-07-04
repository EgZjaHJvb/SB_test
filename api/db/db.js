import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;

const clientOptions = {
    serverApi: { version: '1', strict: true, deprecationErrors: true },
};

/**
 * Connects to MongoDB using Mongoose with the provided URI and options.
 * @returns {Promise<void>} Resolves when connected.
 */
async function run() {
    try {
        await mongoose.connect(uri, clientOptions);
    } finally {
        //await mongoose.disconnect();
    }
}
run().catch(console.dir);

export default run;
