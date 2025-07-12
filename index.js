import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { getQuizQuestion } from "./gemini.js";

dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const quizStates = {};

const startStopKeyboard = {
  reply_markup: {
    keyboard: [["Start", "Stop"]],
    resize_keyboard: true,
  },
};

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

async function sendQuiz(chatId) {
  if (!quizStates[chatId]?.active) return;

  try {
    const quiz = await getQuizQuestion();

    const correctIndex = parseInt(quiz.correct);
    if (isNaN(correctIndex) || correctIndex < 0 || correctIndex > 3) {
      throw new Error("Correct answer not in options");
    }

    const poll = await bot.sendPoll(chatId, `🧠 ${quiz.question}`, quiz.options, {
      type: "quiz",
      correct_option_id: correctIndex,
      is_anonymous: false,
      explanation: `✅ सही उत्तर: ${quiz.options[correctIndex]}`,
    });

    // After 7s, show countdown and send next quiz
    setTimeout(async () => {
      let seconds = 5;
      const countdownMsg = await bot.sendMessage(chatId, `⏳ अगले सवाल तक ${seconds} सेकंड...`);

      const timer = setInterval(async () => {
        seconds--;
        if (seconds <= 0) {
          clearInterval(timer);
          await bot.deleteMessage(chatId, countdownMsg.message_id);
          sendQuiz(chatId);
        } else {
          await bot.editMessageText(`⏳ अगले सवाल तक ${seconds} सेकंड...`, {
            chat_id: chatId,
            message_id: countdownMsg.message_id,
          });
        }
      }, 1000);
    }, 7000);
  } catch (err) {
    console.error("❌ Gemini Error:", err.message);
    await bot.sendMessage(chatId, "⚠️ Gemini error. Retrying in 10s...");
    setTimeout(() => sendQuiz(chatId), 10000);
  }
}
