import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  name: String,
  state: String,
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("User", userSchema);
