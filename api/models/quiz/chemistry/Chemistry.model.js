import mongoose from 'mongoose';

const ChemistryPathwaySchema = new mongoose.Schema({}, { strict: false });

const ChemistryPathway = mongoose.model('ChemistryPathway', ChemistryPathwaySchema, 'chemistry_quiz');

export default ChemistryPathway;
