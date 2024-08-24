import { Telegraf } from "telegraf";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "dotenv";
import axios from "axios";
import fs from "fs";

config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_API);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

const generateDescription = async (imagePath) => {
  const image = {
    inlineData: {
      data: Buffer.from(fs.readFileSync(imagePath)).toString("base64"),
      mimeType: "image/jpg",
    },
  };

  const result = await model.generateContent([image]);
  return result.response.text();
};

bot.on("photo", async (ctx) => {
  const chatId = ctx.chat.id;

  const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;

  const file = await ctx.telegram.getFile(photoId);
  const filePath = file.file_path;

  const url = `https://api.telegram.org/file/bot${bot.token}/${filePath}`;
  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
  });

  const localPath = "downloaded_image.jpg";
  const writer = fs.createWriteStream(localPath);
  response.data.pipe(writer);

  writer.on("finish", async () => {
    try {
      const description = await generateDescription(localPath);

      await ctx.reply(description);
    } catch (error) {
      await ctx.reply(
        "Sorry, I couldn't generate a description for this image."
      );
      console.error("Error generating description:", error);
    }

    fs.unlinkSync(localPath);
  });

  writer.on("error", (err) => {
    ctx.reply("Failed to download the image.");
    console.error("Error downloading image:", err);
  });
});

bot.launch();
console.log("Bot is running...");
