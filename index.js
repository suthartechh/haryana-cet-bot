// index.js
import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { getQuizQuestion } from "./gemini.js";
import { connectDB } from "./db.js";
import User from "./models/User.js";

dotenv.config();

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_URL = `${process.env.BASE_URL}/bot${BOT_TOKEN}`;
const PORT = process.env.PORT || 10000;

await connectDB();

const bot = new TelegramBot(BOT_TOKEN, { webHook: { port: PORT } });
bot.setWebHook(WEBHOOK_URL);

const quizStates = {}; // Stores per-user quiz state and history
const userSteps = {};  // For onboarding (name/state)
const unansweredCounts = {}; // Count unanswered quizzes

const replyKeyboard = {
  reply_markup: {
    keyboard: [[{ text: "▶️ Start Quiz" }, { text: "⏹ Stop Quiz" }]],
    resize_keyboard: true,
    one_time_keyboard: false,
    is_persistent: true,
    input_field_placeholder: "Start or Stop Quiz",
  },
};

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const user = await User.findOne({ telegramId: chatId });

  if (user) {
    bot.sendMessage(chatId, `👋 Welcome back *${user.name}*!`, {
      parse_mode: "Markdown",
      ...replyKeyboard,
    });
  } else {
    userSteps[chatId] = { step: "ask_name" };
    bot.sendMessage(chatId, "👋 Welcome! पहले अपना नाम बताएं:", replyKeyboard);
  }
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  if (!text || msg.via_bot || msg.text.startsWith("/")) return;

  if (userSteps[chatId]) {
    const step = userSteps[chatId].step;

    if (step === "ask_name") {
      userSteps[chatId].name = text;
      userSteps[chatId].step = "ask_state";
      return bot.sendMessage(chatId, "🌾 आप किस राज्य से हैं?", replyKeyboard);
    }

    if (step === "ask_state") {
      await User.create({ telegramId: chatId, name: userSteps[chatId].name, state: text });
      delete userSteps[chatId];
      return bot.sendMessage(chatId, `✅ धन्यवाद! अब आप क्विज़ शुरू कर सकते हैं।`, replyKeyboard);
    }
  }

  const lower = text.toLowerCase();
  if (lower === "▶️ start quiz") {
    if (quizStates[chatId]?.active) {
      return bot.sendMessage(chatId, "⚠️ Quiz already running.", replyKeyboard);
    }
    quizStates[chatId] = { active: true, history: [] };
    unansweredCounts[chatId] = 0;
    await bot.sendMessage(chatId, "✅ Quiz started!", replyKeyboard);
    sendQuiz(chatId);
  }

  if (lower === "⏹ stop quiz") {
    quizStates[chatId] = { active: false, history: [] };
    await bot.sendMessage(chatId, "🛑 Quiz stopped.", replyKeyboard);
  }
});

bot.on("poll_answer", async (answer) => {
  const chatId = answer.user.id;

  if (!quizStates[chatId]?.active) return;

  unansweredCounts[chatId] = 0;

  const lastQuiz = quizStates[chatId].history?.slice(-1)[0];
  if (!lastQuiz) return;

  const explanation = lastQuiz.explanation || "इस प्रश्न का विवरण उपलब्ध नहीं है।";

  await bot.sendMessage(chatId, `📚 *संपूर्ण विवरण:*
${explanation}`, { parse_mode: "Markdown" });

  setTimeout(() => {
    sendQuiz(chatId);
  }, 3000);
});

async function sendQuiz(chatId) {
  if (!quizStates[chatId]?.active) return;

  try {
    const quiz = await getQuizQuestion();
    const correctIndex = parseInt(quiz.correct);

    quiz.explanation = quiz.explanation || "इस प्रश्न का विवरण उपलब्ध नहीं है।";

    if (quizStates[chatId].history.length >= 5) {
      quizStates[chatId].history.shift();
    }
    quizStates[chatId].history.push(quiz);

    await bot.sendPoll(chatId, `😮 ${quiz.question}`, quiz.options, {
      type: "quiz",
      correct_option_id: correctIndex,
      is_anonymous: false,
      explanation: `✅ सही उत्तर: ${quiz.options[correctIndex]}`,
    });
  } catch (err) {
    console.error("❌ Gemini Error:", err.message);
    await bot.sendMessage(chatId, "⚠️ Gemini error. Retrying in 10s...", replyKeyboard);
    setTimeout(() => sendQuiz(chatId), 10000);
  }
}

process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
});

app.post(`/bot${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`✅ MongoDB connected`);
  console.log(`🚀 Webhook server running on port ${PORT}`);
});
