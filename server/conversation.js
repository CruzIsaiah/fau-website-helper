// User questions provide topic context only; evidence still comes from FAU retrieval.
// Navigation intent is checked against the current question before this adapter.
export function contextualQuestion({ question, history = [] }) {
  if (!history.length) return question;
  const previous = history.slice(-3).map(turn => turn.question).join(' / ');
  return `Previous questions for context: ${previous}\nCurrent follow-up question: ${question}`;
}
