// index.js
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { getQuizQuestion } from "./gemini.js";
import { connectDB } from "./db.js";
import { handleAdminCommand } from "./admin.js";
import User from "./models/User.js";

dotenv.config();
await connectDB();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const quizStates = {};
const userSteps = {};
const unansweredCounts = {}; // Track how many quizzes user skipped

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
      return bot.sendMessage(chatId, "🏞️ आप किस राज्य से हैं?", replyKeyboard);
    }

    if (step === "ask_state") {
      await User.create({
        telegramId: chatId,
        name: userSteps[chatId].name,
        state: text,
      });
      delete userSteps[chatId];
      return bot.sendMessage(chatId, `✅ धन्यवाद! अब आप क्विज़ शुरू कर सकते हैं।`, replyKeyboard);
    }
  }

  const lower = text.toLowerCase();
  if (lower === "▶️ start quiz") {
    if (quizStates[chatId]?.active) {
      return bot.sendMessage(chatId, "⚠️ Quiz already running.", replyKeyboard);
    }
    quizStates[chatId] = { active: true };
    unansweredCounts[chatId] = 0;
    await bot.sendMessage(chatId, "✅ Quiz started!", replyKeyboard);
    sendQuiz(chatId);
  }

  if (lower === "⏹ stop quiz") {
    quizStates[chatId] = { active: false };
    await bot.sendMessage(chatId, "🛑 Quiz stopped.", replyKeyboard);
  }
});

bot.onText(/\/sutharadmin/, (msg) => {
  handleAdminCommand(bot, msg);
});

bot.on("poll_answer", (answer) => {
  const chatId = answer.user.id;
  if (quizStates[chatId]) {
    unansweredCounts[chatId] = 0; // user answered
  }
});

async function sendQuiz(chatId) {
  if (!quizStates[chatId]?.active) return;

  try {
    const quiz = await getQuizQuestion();
    const correctIndex = parseInt(quiz.correct);

    const poll = await bot.sendPoll(chatId, `🧠 ${quiz.question}`, quiz.options, {
      type: "quiz",
      correct_option_id: correctIndex,
      is_anonymous: false,
      explanation: `✅ सही उत्तर: ${quiz.options[correctIndex]}`,
    });

    let answered = false;

    const timeout = setTimeout(async () => {
      if (!answered) {
        unansweredCounts[chatId] = (unansweredCounts[chatId] || 0) + 1;
        if (unansweredCounts[chatId] >= 5) {
          quizStates[chatId].active = false;
          await bot.sendMessage(chatId, "⚠️ आपने लगातार 5 सवालों का जवाब नहीं दिया। Quiz रोक दिया गया।", replyKeyboard);
          await new Promise((res) => setTimeout(res, 10000));
          await bot.sendMessage(chatId, "▶️ Quiz को फिर से शुरू करने के लिए 'Start Quiz' दबाएं।", replyKeyboard);
          return;
        }
      }
    }, 7000);

    setTimeout(async () => {
      let seconds = 5;
      const countdownMsg = await bot.sendMessage(chatId, `⏳ अगले सवाल तक ${seconds} सेकंड...`, replyKeyboard);

      const timer = setInterval(async () => {
        seconds--;
        if (seconds <= 0) {
          clearInterval(timer);
          await bot.deleteMessage(chatId, countdownMsg.message_id).catch(() => {});
          sendQuiz(chatId);
        } else {
          await bot.editMessageText(`⏳ अगले सवाल तक ${seconds} सेकंड...`, {
            chat_id: chatId,
            message_id: countdownMsg.message_id,
          }).catch(() => {});
        }
      }, 1000);
    }, 7000);
  } catch (err) {
    console.error("❌ Gemini Error:", err.message);
    await bot.sendMessage(chatId, "⚠️ Gemini error. Retrying in 10s...", replyKeyboard);
    setTimeout(() => sendQuiz(chatId), 10000);
  }
}

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled Rejection:", reason);
});
