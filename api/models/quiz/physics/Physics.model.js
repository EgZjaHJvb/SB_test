import mongoose from 'mongoose';

const PhysicsPathwaySchema = new mongoose.Schema({}, { strict: false });

const PhysicsPathway = mongoose.model('PhysicsPathway', PhysicsPathwaySchema, 'physics_quiz');

export default PhysicsPathway;
