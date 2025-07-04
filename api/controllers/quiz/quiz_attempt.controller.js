export const saveQuizAttempt = async (req, res) => {
  try {
    const { userId, score, totalQuestions, correctAnswers, timeTaken, answers } = req.body;

    if (!userId || !Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ message: 'Missing or invalid data in request.' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid userId format.' });
    }

    const sanitizedAnswers = answers
      .map((answer) => ({
        questionId: mongoose.Types.ObjectId.isValid(answer.questionId)
          ? new mongoose.Types.ObjectId(answer.questionId)
          : null,
        selected: answer.selected || '',
        correct: !!answer.correct,
      }))
      .filter((a) => a.questionId !== null);

    const newQuizAttempt = new QuizAttempt({
      userId: new mongoose.Types.ObjectId(userId),
      score,
      totalQuestions,
      correctAnswers,
      timeTaken,
      answers: sanitizedAnswers,
    });

    await newQuizAttempt.save();

    await UserQuizStats.findOneAndUpdate(
      { userId: newQuizAttempt.userId },
      { $inc: { totalQuizzesAttempted: 1 } },
      { upsert: true, new: true }
    );

    return res.status(201).json({
      message: 'Quiz attempt saved successfully',
      attemptId: newQuizAttempt._id,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error', error });
  }
};
