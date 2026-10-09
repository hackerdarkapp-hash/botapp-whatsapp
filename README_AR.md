# بوت تيليجرام جاهز لإعدادات Render

## الروابط المضافة مسبقًا
- زر Play: https://whats-app-ox-u1.onrender.com
- Join Community: https://t.me/aoot
- Follow on X: https://x.com/OX_U1

## النشر
1. ارفع محتويات هذا المجلد إلى مستودع GitHub.
2. في Render أنشئ خدمة Node.js أو Background Worker تدعم تشغيل البوت باستمرار.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. من إعدادات الخدمة افتح Environment وأضف:

| Key | Value |
|---|---|
| `BOT_TOKEN` | توكن البوت من BotFather |
| `ADMIN_ID` | رقم حسابك في تيليجرام (اختياري للوظائف الإدارية) |

المتغيرات التالية اختيارية؛ الروابط المطلوبة مضبوطة افتراضيًا داخل الكود:
- `PLAY_URL`
- `COMMUNITY_URL`
- `X_URL`
- `SUPPORT_USERNAME`

6. احفظ الإعدادات وأعد النشر.
7. افتح البوت في تيليجرام وأرسل `/start`.

## معرفة Telegram ID
بعد تشغيل البوت، أرسل له `/myid` وسيجيبك برقم حسابك. ضع هذا الرقم في `ADMIN_ID` داخل Render، ثم أعد النشر.

## حماية التوكن
لا تضع `BOT_TOKEN` داخل الكود أو ترفعه إلى GitHub. لا تشارك التوكن مع أي شخص. استخدم Render Environment Variables فقط.

## الأوامر
- `/start` عرض رسالة الترحيب والأزرار.
- `/help` المساعدة.
- `/myid` عرض رقم حساب تيليجرام.
- `/admincheck` اختبار صلاحية المشرف بعد ضبط `ADMIN_ID`.
