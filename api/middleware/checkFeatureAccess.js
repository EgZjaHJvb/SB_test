// controllers/subscription/checkFeatureAccess.controller.js

import { planFeatures } from '../controllers/subscription/planFeatures.controller.js';


export const checkFeatureAccess = (featureName) => {
  return (req, res, next) => {
    if (!req.user || !req.user.subscription || !req.user.subscription.plan) {
      return res.status(401).json({ error: 'Unauthorized: subscription info missing' });
    }

    const userPlan = req.user.subscription.plan.toLowerCase();

    if (userPlan === 'enterprise') {
      // Enterprise plan has access to all features
      return next();
    }

    const allowedFeatures = planFeatures[userPlan] || [];

    if (!allowedFeatures.includes(featureName)) {
      return res.status(403).json({
        error: 'Access denied: Upgrade your plan to access this feature.',
      });
    }

    next();
  };
};
