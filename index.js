const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3002;
const PIN = process.env.CLIPBOARD_PIN;
const COOKIE_NAME = 'clipboard_auth';

if (!PIN) {
  console.error('Falta configurar la variable de entorno CLIPBOARD_PIN');
}

const AUTH_TOKEN = PIN ? crypto.createHash('sha256').update(PIN).digest('hex') : null;

let textoGuardado = '';

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

function estaAutenticado(req) {
  return AUTH_TOKEN && req.cookies[COOKIE_NAME] === AUTH_TOKEN;
}

app.get('/login', (req, res) => {
  res.send(`
    <html>
      <body style="font-family: sans-serif; display: flex; justify-content: center; margin-top: 100px;">
        <form method="POST" action="/login">
          <input type="password" name="pin" placeholder="PIN" autofocus />
          <button type="submit">Entrar</button>
        </form>
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
  res.send('PIN incorrecto. <a href="/login">Volver a intentar</a>');
});

app.get('/', (req, res) => {
  if (!estaAutenticado(req)) {
    return res.redirect('/login');
  }
  res.send(`
    <html>
      <body style="font-family: sans-serif; max-width: 700px; margin: 40px auto;">
        <h3>Portapapeles compartido</h3>
        <textarea id="texto" rows="15" style="width: 100%; font-size: 16px;" autofocus>${textoGuardado}</textarea>
        <br /><br />
        <span id="estado" style="color: gray;"></span>

        <script>
          const textarea = document.getElementById('texto');
          const estado = document.getElementById('estado');

          let ultimoTextoEnviado = textarea.value;
          let escribiendo = false;
          let timerGuardado = null;
          let timerEscribiendo = null;

          async function guardar() {
            const valor = textarea.value;
            if (valor === ultimoTextoEnviado) return;
            ultimoTextoEnviado = valor;
            await fetch('/guardar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ texto: valor })
            });
            estado.textContent = 'Guardado';
            setTimeout(() => estado.textContent = '', 1500);
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