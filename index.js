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
        <form method="POST" action="/guardar">
          <textarea name="texto" rows="15" style="width: 100%; font-size: 16px;" autofocus>${textoGuardado}</textarea>
          <br /><br />
          <button type="submit">Guardar</button>
        </form>
      </body>
    </html>
  `);
});

app.post('/guardar', (req, res) => {
  if (!estaAutenticado(req)) {
    return res.redirect('/login');
  }
  textoGuardado = req.body.texto || '';
  res.redirect('/');
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});