import User from '../models/auth/User.model.js';
import QuizLog from '../models/quiz/QuizLog.model.js';

export const checkQuizAccess = async (userId) => {
  const user = await User.findById(userId).populate('currentSubscription');

  const isActive = user?.currentSubscription?.status === 'active';
  const planType = isActive ? user.currentSubscription.type : 'free';

  const quizCount = await QuizLog.countDocuments({ user: userId });

  if (planType === 'free') {
    if (quizCount >= 1) {
      return {
        allowed: false,
        planType,
        message: 'Free plan allows only one quiz generation. Upgrade to Pro or Enterprise for more access.',
      };
    }
  } else if (planType === 'pro') {
    if (quizCount >= 5) {
      return {
        allowed: false,
        planType,
        message: 'Pro plan allows up to 5 quizzes. Upgrade to Enterprise for unlimited access.',
      };
    }
  }

  return {
    allowed: true,
    planType,
    message: '',
  };
};

