const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const path = require("path");

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = String(process.env.ADMIN_ID || "").trim();
const DATA_DIR = process.env.DATA_DIR || (process.env.RENDER ? "/var/data" : path.join(__dirname, "data"));
const CONFIG_FILE = path.join(DATA_DIR, "config.json");

if (!BOT_TOKEN) {
  console.error("Missing BOT_TOKEN. Add it in Render > Environment.");
  process.exit(1);
}
if (!ADMIN_ID || !/^\d+$/.test(ADMIN_ID)) {
  console.error("Missing or invalid ADMIN_ID. Add your numeric Telegram user ID in Render > Environment.");
  process.exit(1);
}

const DEFAULT_CONFIG = {
  welcomeText: "🐶 <b>مرحبًا بك!</b>\\n\\nاختر أحد الأزرار أدناه للمتابعة.",
  photoFileId: null,
  buttons: [
    { id: "play", label: "🐶 Play", type: "url", value: "https://whats-app-ox-u1.onrender.com" },
    { id: "community", label: "👥 Join Community", type: "url", value: "https://t.me/aoot" },
    { id: "social", label: "𝕏 Follow on X", type: "url", value: "https://x.com/OX_U1" }
  ]
};

let config;
const sessions = new Map();

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
function saveConfig() {
  ensureDataDir();
  const temp = CONFIG_FILE + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(config, null, 2), "utf8");
  fs.renameSync(temp, CONFIG_FILE);
}
function loadConfig() {
  ensureDataDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    config = structuredClone(DEFAULT_CONFIG);
    saveConfig();
    return;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    config = {
      welcomeText: typeof parsed.welcomeText === "string" ? parsed.welcomeText : DEFAULT_CONFIG.welcomeText,
      photoFileId: parsed.photoFileId || null,
      buttons: Array.isArray(parsed.buttons) ? parsed.buttons : structuredClone(DEFAULT_CONFIG.buttons)
    };
  } catch (e) {
    console.error("Could not read config.json:", e.message);
    config = structuredClone(DEFAULT_CONFIG);
    saveConfig();
  }
}
loadConfig();

const bot = new Telegraf(BOT_TOKEN);
const isAdmin = (ctx) => String(ctx.from?.id || "") === ADMIN_ID;
const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const uid = () => Math.random().toString(36).slice(2, 10);
const findNode = (id, nodes = config.buttons, parent = null) => {
  for (const node of nodes) {
    if (node.id === id) return { node, parent, siblings: nodes };
    if (node.type === "submenu" && Array.isArray(node.children)) {
      const found = findNode(id, node.children, node);
      if (found) return found;
    }
  }
  return null;
};
function pathFor(id, nodes = config.buttons, prefix = []) {
  for (const node of nodes) {
    const next = [...prefix, node.label];
    if (node.id === id) return next;
    if (node.type === "submenu") {
      const found = pathFor(id, node.children || [], next);
      if (found) return found;
    }
  }
  return [];
}
function truncate(s, max = 45) {
  s = String(s || "");
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
function userKeyboard(nodes, parentId = null) {
  const rows = nodes.map(node => {
    if (node.type === "url") return [Markup.button.url(node.label, node.value)];
    return [Markup.button.callback(node.label, `menu:${node.id}`)];
  });
  if (parentId) rows.push([Markup.button.callback("⬅️ رجوع", `menu:back:${parentId}`)]);
  return Markup.inlineKeyboard(rows);
}
async function showWelcome(ctx, edit = false) {
  const keyboard = userKeyboard(config.buttons);
  if (config.photoFileId) {
    if (edit) {
      try {
        await ctx.editMessageMedia({
          type: "photo",
          media: config.photoFileId,
          caption: config.welcomeText,
          parse_mode: "HTML"
        }, keyboard);
        return;
      } catch (_) {}
    }
    await ctx.replyWithPhoto(config.photoFileId, {
      caption: config.welcomeText,
      parse_mode: "HTML",
      ...keyboard
    });
  } else {
    if (edit) {
      try {
        await ctx.editMessageText(config.welcomeText, { parse_mode: "HTML", ...keyboard });
        return;
      } catch (_) {}
    }
    await ctx.reply(config.welcomeText, { parse_mode: "HTML", ...keyboard });
  }
}
async function showSubmenu(ctx, node, edit = true) {
  const text = node.description ? `${escapeHtml(node.description)}` : `<b>${escapeHtml(node.label)}</b>`;
  const keyboard = userKeyboard(node.children || [], node.id);
  if (edit) {
    try {
      await ctx.editMessageText(text, { parse_mode: "HTML", ...keyboard });
      return;
    } catch (_) {}
  }
  await ctx.reply(text, { parse_mode: "HTML", ...keyboard });
}
function adminHomeKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("✏️ تعديل نص الترحيب", "adm:text")],
    [Markup.button.callback("🖼 تغيير صورة القائمة", "adm:photo")],
    [Markup.button.callback("🔘 إدارة الأزرار والقوائم", "adm:buttons")],
    [Markup.button.callback("👁 معاينة القائمة", "adm:preview")],
    [Markup.button.callback("ℹ️ المساعدة", "adm:help")]
  ]);
}
async function adminHome(ctx, edit = false) {
  const text = "🛠 <b>لوحة تحكم الأدمن</b>\n\nيمكنك تعديل نص الترحيب والصورة والأزرار والقوائم الفرعية. التغييرات تحفظ تلقائيًا.";
  if (edit && ctx.callbackQuery) {
    try { await ctx.editMessageText(text, { parse_mode: "HTML", ...adminHomeKeyboard() }); return; } catch (_) {}
  }
  await ctx.reply(text, { parse_mode: "HTML", ...adminHomeKeyboard() });
}
function buttonTreeKeyboard(nodes, parentId = null) {
  const rows = nodes.map(node => [Markup.button.callback(
    `${node.type === "submenu" ? "📂" : node.type === "url" ? "🔗" : "💬"} ${truncate(node.label, 35)}`,
    `adm:node:${node.id}`
  )]);
  rows.push([Markup.button.callback(parentId ? "➕ إضافة زر داخل هذه القائمة" : "➕ إضافة زر رئيسي", `adm:add:${parentId || "root"}`)]);
  if (parentId) rows.push([Markup.button.callback("⬅️ رجوع للقائمة الرئيسية", "adm:buttons")]);
  rows.push([Markup.button.callback("🏠 لوحة الأدمن", "adm:home")]);
  return Markup.inlineKeyboard(rows);
}
async function showButtonTree(ctx, parentId = null, edit = true) {
  const nodes = parentId ? (findNode(parentId)?.node.children || []) : config.buttons;
  const heading = parentId
    ? `🔘 <b>أزرار القائمة الفرعية:</b> ${escapeHtml(findNode(parentId)?.node.label || "")}`
    : "🔘 <b>إدارة الأزرار الرئيسية</b>";
  const text = `${heading}\n\nاختر زرًا لتعديله، أو أضف زرًا جديدًا.`;
  const keyboard = buttonTreeKeyboard(nodes, parentId);
  if (edit && ctx.callbackQuery) {
    try { await ctx.editMessageText(text, { parse_mode: "HTML", ...keyboard }); return; } catch (_) {}
  }
  await ctx.reply(text, { parse_mode: "HTML", ...keyboard });
}
function nodeAdminKeyboard(node) {
  const rows = [
    [Markup.button.callback("✏️ تغيير اسم الزر", `adm:rename:${node.id}`)],
    [Markup.button.callback("📝 تعديل النص الداخلي", `adm:desc:${node.id}`)]
  ];
  if (node.type === "url") rows.push([Markup.button.callback("🔗 تغيير الرابط", `adm:url:${node.id}`)]);
  if (node.type === "submenu") rows.push([Markup.button.callback("📂 إدارة الأزرار داخل القائمة", `adm:children:${node.id}`)]);
  rows.push([Markup.button.callback("🗑 حذف الزر", `adm:delete:${node.id}`)]);
  rows.push([Markup.button.callback("⬅️ رجوع", "adm:buttons")]);
  return Markup.inlineKeyboard(rows);
}
function prompt(ctx, session, text) {
  sessions.set(String(ctx.from.id), session);
  return ctx.reply(text, { parse_mode: "HTML", ...Markup.forceReply() });
}
async function finishAdd(ctx, session) {
  const node = { id: uid(), label: session.label, type: session.type };
  if (session.type === "url") node.value = session.value;
  if (session.type === "text") node.description = session.value;
  if (session.type === "submenu") { node.description = session.value || ""; node.children = []; }
  const target = session.parentId ? findNode(session.parentId)?.node : null;
  if (session.parentId && (!target || target.type !== "submenu")) {
    await ctx.reply("تعذر العثور على القائمة الأب. ابدأ من /admin مرة أخرى.");
    return;
  }
  const destination = target ? target.children : config.buttons;
  destination.push(node);
  saveConfig();
  sessions.delete(String(ctx.from.id));
  await ctx.reply("✅ تمت إضافة الزر وحفظ التغييرات.");
  if (target) await showButtonTree(ctx, target.id, false);
  else await showButtonTree(ctx, null, false);
}

bot.start(async (ctx) => {
  await showWelcome(ctx);
});
bot.command("admin", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply("⛔ هذا الأمر مخصص للأدمن.");
  await adminHome(ctx);
});
bot.command("myid", async (ctx) => {
  await ctx.reply(`Telegram ID: ${ctx.from.id}`);
});
bot.command("cancel", async (ctx) => {
  sessions.delete(String(ctx.from.id));
  await ctx.reply("تم إلغاء العملية.");
});
bot.command("help", async (ctx) => {
  await ctx.reply("أرسل /start لعرض القائمة.\nالأدمن: /admin\nمعرفة رقم حسابك: /myid\nإلغاء أي عملية: /cancel");
});

bot.action(/^menu:(.+)$/, async (ctx) => {
  const arg = ctx.match[1];
  if (arg.startsWith("back:")) {
    const parentId = arg.slice(5);
    await ctx.answerCbQuery();
    if (parentId === "root") return showWelcome(ctx, true);
    const parent = findNode(parentId);
    if (parent && parent.node.type === "submenu") return showSubmenu(ctx, parent.node, true);
    return showWelcome(ctx, true);
  }
  const found = findNode(arg);
  if (!found) {
    await ctx.answerCbQuery("هذا الزر غير متاح حاليًا.");
    return;
  }
  if (found.node.type === "text") {
    await ctx.answerCbQuery();
    const text = found.node.description || found.node.value || found.node.label;
    const backId = found.parent ? found.parent.id : "root";
    const keyboard = Markup.inlineKeyboard([[Markup.button.callback("⬅️ رجوع", `menu:back:${backId}`)]]);
    try { await ctx.editMessageText(text, { ...keyboard }); } catch (_) { await ctx.reply(text, keyboard); }
    return;
  }
  if (found.node.type !== "submenu") {
    await ctx.answerCbQuery("هذا الزر غير متاح حاليًا.");
    return;
  }
  await ctx.answerCbQuery();
  await showSubmenu(ctx, found.node, true);
});

bot.action("adm:home", async ctx => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("غير مسموح", { show_alert: true });
  await ctx.answerCbQuery();
  await adminHome(ctx, true);
});
bot.action("adm:help", async ctx => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("غير مسموح", { show_alert: true });
  await ctx.answerCbQuery();
  await ctx.reply("الأوامر:\n/admin لوحة التحكم\n/start معاينة القائمة للمستخدم\n/myid رقم حساب تيليجرام\n/cancel إلغاء عملية.\n\nعند تغيير الصورة، اضغط تغيير الصورة ثم أرسل الصورة كرسالة إلى البوت.");
});
bot.action("adm:text", async ctx => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("غير مسموح", { show_alert: true });
  await ctx.answerCbQuery();
  await prompt(ctx, { action: "welcomeText" }, "أرسل نص الترحيب الجديد. يمكنك استخدام تنسيق HTML مثل <code>&lt;b&gt;نص عريض&lt;/b&gt;</code>.");
});
bot.action("adm:photo", async ctx => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("غير مسموح", { show_alert: true });
  await ctx.answerCbQuery();
  await prompt(ctx, { action: "photo" }, "أرسل الصورة التي تريد ظهورها أعلى القائمة. لإزالة الصورة أرسل /removephoto.");
});
bot.command("removephoto", async ctx => {
  if (!isAdmin(ctx)) return;
  config.photoFileId = null;
  saveConfig();
  sessions.delete(String(ctx.from.id));
  await ctx.reply("تم حذف صورة القائمة.");
});
bot.action("adm:preview", async ctx => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("غير مسموح", { show_alert: true });
  await ctx.answerCbQuery();
  await showWelcome(ctx);
});
bot.action("adm:buttons", async ctx => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("غير مسموح", { show_alert: true });
  await ctx.answerCbQuery();
  await showButtonTree(ctx, null, true);
});
bot.action(/^adm:children:(.+)$/, async ctx => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("غير مسموح", { show_alert: true });
  const id = ctx.match[1], found = findNode(id);
  await ctx.answerCbQuery();
  if (!found || found.node.type !== "submenu") return ctx.reply("هذه ليست قائمة فرعية.");
  await showButtonTree(ctx, id, true);
});
bot.action(/^adm:node:(.+)$/, async ctx => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("غير مسموح", { show_alert: true });
  const found = findNode(ctx.match[1]);
  await ctx.answerCbQuery();
  if (!found) return ctx.reply("لم يتم العثور على الزر.");
  await ctx.editMessageText(
    `إدارة الزر: <b>${escapeHtml(found.node.label)}</b>\nالنوع: <code>${escapeHtml(found.node.type)}</code>`,
    { parse_mode: "HTML", ...nodeAdminKeyboard(found.node) }
  );
});
bot.action(/^adm:add:(.+)$/, async ctx => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("غير مسموح", { show_alert: true });
  const parentId = ctx.match[1] === "root" ? null : ctx.match[1];
  if (parentId) {
    const parent = findNode(parentId)?.node;
    if (!parent || parent.type !== "submenu") return ctx.answerCbQuery("القائمة الأب غير صالحة", { show_alert: true });
  }
  await ctx.answerCbQuery();
  await prompt(ctx, { action: "addLabel", parentId }, "أرسل اسم الزر الجديد.");
});
bot.action(/^adm:rename:(.+)$/, async ctx => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("غير مسموح", { show_alert: true });
  await ctx.answerCbQuery();
  await prompt(ctx, { action: "rename", nodeId: ctx.match[1] }, "أرسل الاسم الجديد للزر.");
});
bot.action(/^adm:desc:(.+)$/, async ctx => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("غير مسموح", { show_alert: true });
  await ctx.answerCbQuery();
  await prompt(ctx, { action: "description", nodeId: ctx.match[1] }, "أرسل النص الذي يظهر عند فتح هذا الزر. أرسل - لمسح النص.");
});
bot.action(/^adm:url:(.+)$/, async ctx => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("غير مسموح", { show_alert: true });
  await ctx.answerCbQuery();
  await prompt(ctx, { action: "url", nodeId: ctx.match[1] }, "أرسل الرابط الكامل، ويجب أن يبدأ بـ https:// أو http://");
});
bot.action(/^adm:delete:(.+)$/, async ctx => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("غير مسموح", { show_alert: true });
  const found = findNode(ctx.match[1]);
  await ctx.answerCbQuery();
  if (!found) return ctx.reply("لم يتم العثور على الزر.");
  found.siblings.splice(found.siblings.findIndex(n => n.id === found.node.id), 1);
  saveConfig();
  await ctx.reply("🗑 تم حذف الزر وحفظ التغييرات.");
  await showButtonTree(ctx, null, false);
});

bot.on("message", async ctx => {
  if (!isAdmin(ctx)) return;
  const key = String(ctx.from.id);
  const session = sessions.get(key);
  if (!session) return;
  if (ctx.message.text && ctx.message.text.startsWith("/")) return;

  if (session.action === "photo") {
    const photos = ctx.message.photo;
    if (!photos || !photos.length) return ctx.reply("أرسل صورة كصورة، وليس ملفًا أو نصًا.");
    config.photoFileId = photos[photos.length - 1].file_id;
    saveConfig(); sessions.delete(key);
    return ctx.reply("🖼 تم حفظ الصورة.");
  }

  if (session.action === "welcomeText") {
    if (!ctx.message.text) return ctx.reply("أرسل نصًا عاديًا.");
    config.welcomeText = ctx.message.text;
    saveConfig(); sessions.delete(key);
    return ctx.reply("✅ تم حفظ نص الترحيب.");
  }

  if (session.action === "addLabel") {
    if (!ctx.message.text || !ctx.message.text.trim()) return ctx.reply("أرسل اسمًا نصيًا للزر.");
    session.label = ctx.message.text.trim().slice(0, 64);
    sessions.set(key, session);
    return ctx.reply("اختر نوع الزر بإرسال كلمة واحدة:\nurl — رابط مباشر\nsubmenu — قائمة فرعية\ntext — زر يعرض نصًا");
  }

  if (session.action === "addLabel" && false) return;

  if (session.action === "rename") {
    if (!ctx.message.text || !ctx.message.text.trim()) return ctx.reply("أرسل اسمًا نصيًا.");
    const found = findNode(session.nodeId);
    if (!found) { sessions.delete(key); return ctx.reply("لم يتم العثور على الزر."); }
    found.node.label = ctx.message.text.trim().slice(0, 64);
    saveConfig(); sessions.delete(key);
    return ctx.reply("✅ تم تغيير اسم الزر.");
  }

  if (session.action === "description") {
    const found = findNode(session.nodeId);
    if (!found) { sessions.delete(key); return ctx.reply("لم يتم العثور على الزر."); }
    found.node.description = ctx.message.text === "-" ? "" : (ctx.message.text || "");
    saveConfig(); sessions.delete(key);
    return ctx.reply("✅ تم حفظ النص.");
  }

  if (session.action === "url") {
    const value = (ctx.message.text || "").trim();
    try {
      const parsed = new URL(value);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
    } catch { return ctx.reply("الرابط غير صالح. أرسل رابطًا يبدأ بـ https:// أو http://"); }
    const found = findNode(session.nodeId);
    if (!found) { sessions.delete(key); return ctx.reply("لم يتم العثور على الزر."); }
    found.node.type = "url";
    found.node.value = value;
    delete found.node.children;
    saveConfig(); sessions.delete(key);
    return ctx.reply("✅ تم حفظ الرابط.");
  }

  if (session.action === "addType") {
    const type = (ctx.message.text || "").trim().toLowerCase();
    if (!["url", "submenu", "text"].includes(type)) return ctx.reply("أرسل نوعًا واحدًا فقط: url أو submenu أو text.");
    session.type = type;
    if (type === "url") {
      session.action = "addUrl";
      sessions.set(key, session);
      return ctx.reply("أرسل الرابط الكامل للزر (https:// أو http://).");
    }
    if (type === "text") {
      session.action = "addText";
      sessions.set(key, session);
      return ctx.reply("أرسل النص الذي سيظهر عند الضغط على الزر.");
    }
    session.action = "addSubmenuDescription";
    sessions.set(key, session);
    return ctx.reply("أرسل وصف القائمة الفرعية (أو أرسل - بدون وصف). بعد ذلك يمكنك إضافة أزرار داخلها.");
  }

  if (session.action === "addUrl") {
    const value = (ctx.message.text || "").trim();
    try {
      const parsed = new URL(value);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
    } catch { return ctx.reply("الرابط غير صالح. أرسل رابطًا يبدأ بـ https:// أو http://"); }
    session.value = value;
    return finishAdd(ctx, session);
  }

  if (session.action === "addText") {
    session.value = ctx.message.text || "";
    session.type = "text";
    // Text-type buttons are implemented as submenu-style callbacks with no children.
    return finishAdd(ctx, session);
  }

  if (session.action === "addSubmenuDescription") {
    session.value = ctx.message.text === "-" ? "" : (ctx.message.text || "");
    session.type = "submenu";
    return finishAdd(ctx, session);
  }
});

bot.catch(err => console.error("Bot error:", err));
bot.launch()
  .then(() => console.log(`Bot started. Persistent config file: ${CONFIG_FILE}`))
  .catch(err => { console.error("Failed to start bot:", err); process.exit(1); });

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
