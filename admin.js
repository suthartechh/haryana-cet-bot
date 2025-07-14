import User from "./models/User.js";

export async function handleAdminCommand(bot, msg) {
  const chatId = msg.chat.id;

  // ✅ (Optional) Admin-only check (replace with your Telegram user ID)
  const ADMIN_ID = 1485986589; // <-- your Telegram ID
  if (msg.from.id !== ADMIN_ID) {
    return bot.sendMessage(chatId, "❌ Unauthorized access.");
  }

  try {
    const users = await User.find();

    if (users.length === 0) {
      return bot.sendMessage(chatId, "📭 कोई यूज़र नहीं मिला।");
    }

    let message = `📋 *Registered Users (${users.length})*\n\n`;

    users.forEach((user, i) => {
      message += `👤 *User ${i + 1}*\n🆔 ID: \`${user.telegramId}\`\n👨‍💼 Name: ${user.name || "—"}\n🌐 State: ${user.state || "—"}\n🕒 Joined: ${user.createdAt.toLocaleString()}\n\n`;
    });

    await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("❌ Admin command error:", err.message);
    bot.sendMessage(chatId, "⚠️ Error fetching users.");
  }
}
