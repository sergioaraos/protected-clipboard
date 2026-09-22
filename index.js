const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3002;
const PIN = process.env.CLIPBOARD_PIN;
const COOKIE_NAME = 'clipboard_auth';
const MINUTOS_EXPIRACION = 5;

if (!PIN) {
  console.error('Falta configurar la variable de entorno CLIPBOARD_PIN');
}

const AUTH_TOKEN = PIN ? crypto.createHash('sha256').update(PIN).digest('hex') : null;

let textoGuardado = '';
let timerExpiracion = null;

function reiniciarExpiracion() {
  if (timerExpiracion) clearTimeout(timerExpiracion);
  timerExpiracion = setTimeout(() => {
    textoGuardado = '';
  }, MINUTOS_EXPIRACION * 60 * 1000);
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

function estaAutenticado(req) {
  return AUTH_TOKEN && req.cookies[COOKIE_NAME] === AUTH_TOKEN;
}

const estilos = `
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(180deg, #1a1d29 0%, #0f1117 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      color: #e8e9ed;
    }
    .app {
      width: 100%;
      max-width: 460px;
      padding: 24px 16px 40px;
    }
    .card {
      background: #1e2130;
      border-radius: 20px;
      padding: 20px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.35);
      border: 1px solid #2a2e42;
    }
    h1 {
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 4px;
      color: #fff;
    }
    .subtitulo {
      font-size: 13px;
      color: #8b8fa3;
      margin: 0 0 16px;
    }
    textarea {
      width: 100%;
      min-height: 220px;
      background: #14161f;
      color: #e8e9ed;
      border: 1px solid #2a2e42;
      border-radius: 14px;
      padding: 14px;
      font-size: 16px;
      line-height: 1.4;
      resize: vertical;
      outline: none;
    }
    textarea:focus {
      border-color: #5b6bf5;
    }
    .botones {
      display: flex;
      gap: 10px;
      margin-top: 14px;
    }
    button {
      flex: 1;
      border: none;
      border-radius: 12px;
      padding: 13px 10px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.1s ease, opacity 0.2s ease;
    }
    button:active { transform: scale(0.97); }
    .btn-primario {
      background: #5b6bf5;
      color: #fff;
    }
    .btn-secundario {
      background: #2a2e42;
      color: #e8e9ed;
    }
    .estado {
      display: block;
      text-align: center;
      margin-top: 12px;
      font-size: 13px;
      color: #6ee7a0;
      min-height: 16px;
    }
    .login-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      width: 100%;
    }
    input[type="password"] {
      width: 100%;
      background: #14161f;
      color: #fff;
      border: 1px solid #2a2e42;
      border-radius: 12px;
      padding: 14px;
      font-size: 18px;
      text-align: center;
      letter-spacing: 4px;
      outline: none;
      margin-bottom: 14px;
    }
    input[type="password"]:focus { border-color: #5b6bf5; }
    .error { color: #f66; font-size: 13px; text-align: center; margin-top: 10px; }
  </style>
`;

app.get('/login', (req, res) => {
  res.send(`
    <html>
      <head>${estilos}</head>
      <body>
        <div class="login-wrap">
          <div class="app">
            <div class="card">
              <h1>Portapapeles compartido</h1>
              <p class="subtitulo">Ingresa tu PIN para continuar</p>
              <form method="POST" action="/login">
                <input type="password" name="pin" placeholder="••••" autofocus />
                <button type="submit" class="btn-primario" style="width:100%;">Entrar</button>
              </form>
            </div>
          </div>
        </div>
      </body>
    </html>
  `);
});

app.post('/login', (req, res) => {
  if (PIN && req.body.pin === PIN) {
    res.cookie(COOKIE_NAME, AUTH_TOKEN, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 24 * 30
    });
    return res.redirect('/');
  }
  res.send(`
    <html>
      <head>${estilos}</head>
      <body>
        <div class="login-wrap">
          <div class="app">
            <div class="card">
              <h1>Portapapeles compartido</h1>
              <p class="subtitulo">Ingresa tu PIN para continuar</p>
              <form method="POST" action="/login">
                <input type="password" name="pin" placeholder="••••" autofocus />
                <button type="submit" class="btn-primario" style="width:100%;">Entrar</button>
              </form>
              <p class="error">PIN incorrecto</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `);
});

app.get('/', (req, res) => {
  if (!estaAutenticado(req)) {
    return res.redirect('/login');
  }
  res.send(`
    <html>
      <head>${estilos}</head>
      <body>
        <div class="app">
          <div class="card">
            <h1>Portapapeles compartido</h1>
            <p class="subtitulo">Se guarda solo mientras escribes</p>
            <textarea id="texto" autofocus>${textoGuardado}</textarea>
            <div class="botones">
              <button class="btn-secundario" id="seleccionar">Seleccionar todo</button>
              <button class="btn-primario" id="copiar">Copiar</button>
            </div>
            <span id="estado" class="estado"></span>
          </div>
        </div>

        <script>
          const textarea = document.getElementById('texto');
          const estado = document.getElementById('estado');
          const btnSeleccionar = document.getElementById('seleccionar');
          const btnCopiar = document.getElementById('copiar');

          let ultimoTextoEnviado = textarea.value;
          let escribiendo = false;
          let timerGuardado = null;
          let timerEscribiendo = null;

          function mostrarEstado(msg) {
            estado.textContent = msg;
            setTimeout(() => { estado.textContent = ''; }, 1500);
          }

          async function guardar() {
            const valor = textarea.value;
            if (valor === ultimoTextoEnviado) return;
            ultimoTextoEnviado = valor;
            await fetch('/guardar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ texto: valor })
            });
            mostrarEstado('Guardado');
          }

          textarea.addEventListener('input', () => {
            escribiendo = true;
            clearTimeout(timerEscribiendo);
            clearTimeout(timerGuardado);
            timerGuardado = setTimeout(guardar, 800);
            timerEscribiendo = setTimeout(() => { escribiendo = false; }, 1500);
          });

          async function refrescar() {
            if (escribiendo) return;
            const res = await fetch('/texto');
            const datos = await res.json();
            if (datos.texto !== ultimoTextoEnviado) {
              ultimoTextoEnviado = datos.texto;
              textarea.value = datos.texto;
            }
          }

          btnSeleccionar.addEventListener('click', () => {
            textarea.focus();
            textarea.select();
          });

          btnCopiar.addEventListener('click', async () => {
            textarea.select();
            try {
              await navigator.clipboard.writeText(textarea.value);
            } catch (e) {
              document.execCommand('copy');
            }
            mostrarEstado('Copiado');
          });

          setInterval(refrescar, 2000);
        </script>
      </body>
    </html>
  `);
});

app.post('/guardar', (req, res) => {
  if (!estaAutenticado(req)) {
    return res.status(401).json({ error: 'no autenticado' });
  }
  textoGuardado = req.body.texto || '';
  reiniciarExpiracion();
  res.json({ ok: true });
});

app.get('/texto', (req, res) => {
  if (!estaAutenticado(req)) {
    return res.status(401).json({ error: 'no autenticado' });
  }
  res.json({ texto: textoGuardado });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});