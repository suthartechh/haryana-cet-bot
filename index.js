import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import http from "http";
import { getQuizQuestion } from "./gemini.js";

dotenv.config();

// Dummy server to keep Render alive
http.createServer((req, res) => {
  res.write("🤖 Bot is alive!");
  res.end();
}).listen(process.env.PORT || 3000);

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const quizStates = {};

const startStopKeyboard = {
  reply_markup: {
    keyboard: [["Start", "Stop"]],
    resize_keyboard: true,
  },
};

// Start command
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "👋 Welcome to *Haryana GK Quiz Bot!*\nMade By *Manmohan Suthar* | Insta: @manmohan.suthar",
    {
      parse_mode: "Markdown",
      ...startStopKeyboard,
    }
  );
});

// Handle messages
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.toLowerCase();

  if (text === "start") {
    if (quizStates[chatId]?.active) {
      return bot.sendMessage(chatId, "⚠️ Quiz already running.");
    }

    quizStates[chatId] = { active: true };
    await bot.sendMessage(chatId, "✅ Quiz started!");
    sendQuiz(chatId);
  }

  if (text === "stop") {
    quizStates[chatId] = { active: false };
    await bot.sendMessage(chatId, "🛑 Quiz stopped.");
  }
});

// Main quiz function
async function sendQuiz(chatId) {
  if (!quizStates[chatId]?.active) return;

  try {
    const quiz = await getQuizQuestion();
    const correctIndex = parseInt(quiz.correct);

    if (isNaN(correctIndex) || correctIndex < 0 || correctIndex > 3) {
      throw new Error("Invalid correct option index");
    }

    await bot.sendPoll(chatId, `🧠 ${quiz.question}`, quiz.options, {
      type: "quiz",
      correct_option_id: correctIndex,
      is_anonymous: false,
      explanation: `✅ सही उत्तर: ${quiz.options[correctIndex]}`,
    });

    // Wait and show countdown
    setTimeout(async () => {
      let seconds = 5;
      const msg = await bot.sendMessage(chatId, `⏳ अगले सवाल तक ${seconds} सेकंड...`);
      const interval = setInterval(async () => {
        seconds--;
        if (seconds <= 0) {
          clearInterval(interval);
          await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
          sendQuiz(chatId);
        } else {
          await bot.editMessageText(`⏳ अगले सवाल तक ${seconds} सेकंड...`, {
            chat_id: chatId,
            message_id: msg.message_id,
          }).catch(() => {});
        }
      }, 1000);
    }, 7000);
  } catch (err) {
    console.error("❌ Quiz error:", err.message);
    bot.sendMessage(chatId, "⚠️ कुछ गड़बड़ हो गई। 10 सेकंड में फिर कोशिश करेंगे...").catch(() => {});
    setTimeout(() => sendQuiz(chatId), 10000);
  }
}

// Global safety: don't crash server
process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("💥 Unhandled Rejection:", reason);
});
