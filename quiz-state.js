const userStates = {};

function startQuiz(chatId) {
  userStates[chatId] = { active: true };
}

function stopQuiz(chatId) {
  userStates[chatId] = { active: false };
}

function isActive(chatId) {
  return userStates[chatId]?.active;
}

export { startQuiz, stopQuiz, isActive };
