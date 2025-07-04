import mongoose from 'mongoose';

const MathsPathwaySchema = new mongoose.Schema({}, { strict: false });

const MathsPathway = mongoose.model('MathsPathway', MathsPathwaySchema, 'maths_quiz');

export default MathsPathway;
