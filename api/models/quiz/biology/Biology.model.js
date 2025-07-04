import mongoose from 'mongoose';

const BiologyPathwaySchema = new mongoose.Schema({}, { strict: false });

const BiologyPathway = mongoose.model('BiologyPathway', BiologyPathwaySchema, 'biology_quiz');

export default BiologyPathway;
