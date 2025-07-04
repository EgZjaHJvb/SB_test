// middleware/checkSurveyStatus.js
export default function checkSurveyStatus(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  if (!req.user.surveyFilled) {
    return res.status(403).json({ redirect: '/survey', message: "Please complete the survey." });
  }

  next();
}
