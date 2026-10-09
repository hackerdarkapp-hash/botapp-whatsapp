const { Telegraf, Markup } = require("telegraf");

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("Missing BOT_TOKEN. Add it in Render > Environment.");
  process.exit(1);
}

const ADMIN_ID = process.env.ADMIN_ID ? Number(process.env.ADMIN_ID) : null;

const playUrl = process.env.PLAY_URL || "https://whats-app-ox-u1.onrender.com";
const communityUrl = process.env.COMMUNITY_URL || "https://t.me/aoot";
const xUrl = process.env.X_URL || "https://x.com/OX_U1";
const supportUsername = (process.env.SUPPORT_USERNAME || "OX_U1").replace(/^@/, "");

function validateUrl(value, name) {
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
  } catch {
    console.error(`${name} must be a valid http:// or https:// URL.`);
    process.exit(1);
  }
}

validateUrl(playUrl, "PLAY_URL");
validateUrl(communityUrl, "COMMUNITY_URL");
validateUrl(xUrl, "X_URL");

const bot = new Telegraf(token);

const welcomeText = [
  "🐶 <b>Welcome!</b>",
  "",
  "🎯 Tap Play to open our website.",
  "🏆 Join our community and follow us for updates.",
  "",
  "💎 <b>Quick links</b>",
  "Choose one of the buttons below.",
  "",
  "🚀 Let's get started!"
].join("\n");

const buttons = Markup.inlineKeyboard([
  [Markup.button.url("🐶 Play 🐶", playUrl)],
  [Markup.button.url("Join Community", communityUrl)],
  [Markup.button.url("Follow on X", xUrl)]
]);

bot.start(async (ctx) => {
  await ctx.reply(welcomeText, { parse_mode: "HTML", ...buttons });
});

bot.command("help", async (ctx) => {
  await ctx.reply(`Use /start to show the welcome message and buttons.\nAccount: @${supportUsername}`, buttons);
});

// Optional admin check for future admin-only commands.
function isAdmin(ctx) {
  return ADMIN_ID !== null && String(ctx.from?.id) === String(ADMIN_ID);
}

bot.command("myid", async (ctx) => {
  await ctx.reply(`Your Telegram ID: ${ctx.from.id}`);
});

bot.command("admincheck", async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.reply("This command is available to the configured admin only.");
    return;
  }
  await ctx.reply("Admin ID verified.");
});

bot.catch((err) => console.error("Telegram bot error:", err));

bot.launch()
  .then(() => console.log("Bot started."))
  .catch((err) => {
    console.error("Could not start bot:", err);
    process.exit(1);
  });

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
