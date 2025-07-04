import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['free', 'pro', 'enterprise'],
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'trialing', 'cancelled', 'inactive'],
      default: 'inactive',
    },
    stripeCustomerId: {
      type: String,
      default: null,
    },
    stripeSubscriptionId: {
      type: String,
      default: null,
    },
    planStart: {
      type: Date,
    },
    planEnd: {
      type: Date,
    },
  },
  { timestamps: true } // automatically adds createdAt and updatedAt
);

const Subscription = mongoose.model('Subscription', subscriptionSchema);
export default Subscription;
