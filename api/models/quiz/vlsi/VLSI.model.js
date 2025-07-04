import mongoose from 'mongoose';

const VLSIPathwaySchema = new mongoose.Schema({}, { strict: false });

const VLSIPathway = mongoose.model('VLSIPathway', VLSIPathwaySchema, 'vlsi_quiz');

export default VLSIPathway;
