export function getRandomQuizType(questions) {
  const types = Object.keys(questions).filter(
    (key) => Array.isArray(questions[key]) && questions[key].length > 0
  );
  const randomIndex = Math.floor(Math.random() * types.length);
  return types[randomIndex];
}
1