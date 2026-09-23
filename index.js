const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;
const PIN = process.env.CLIPBOARD_PIN;
const COOKIE_NAME = 'clipboard_auth';
const MINUTOS_EXPIRACION = 5;
const CARPETA_UPLOADS = path.join(__dirname, 'uploads');
const TAMANO_MAXIMO = 100 * 1024 * 1024; // 100 MB

if (!fs.existsSync(CARPETA_UPLOADS)) {
  fs.mkdirSync(CARPETA_UPLOADS);
}

if (!PIN) {
  console.error('Falta configurar la variable de entorno CLIPBOARD_PIN');
}

const AUTH_TOKEN = PIN ? crypto.createHash('sha256').update(PIN).digest('hex') : null;

let textoGuardado = '';
let timerExpiracionTexto = null;

let archivoActual = null; // { nombreOriginal, nombreDisco, tamano }
let timerExpiracionArchivo = null;

function reiniciarExpiracionTexto() {
  if (timerExpiracionTexto) clearTimeout(timerExpiracionTexto);
  timerExpiracionTexto = setTimeout(() => {
    textoGuardado = '';
  }, MINUTOS_EXPIRACION * 60 * 1000);
}

function borrarArchivoActual() {
  if (archivoActual) {
    const ruta = path.join(CARPETA_UPLOADS, archivoActual.nombreDisco);
    fs.unlink(ruta, () => {});
    archivoActual = null;
  }
}

function reiniciarExpiracionArchivo() {
  if (timerExpiracionArchivo) clearTimeout(timerExpiracionArchivo);
  timerExpiracionArchivo = setTimeout(borrarArchivoActual, MINUTOS_EXPIRACION * 60 * 1000);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CARPETA_UPLOADS),
  filename: (req, file, cb) => {
    const nombreDisco = crypto.randomBytes(8).toString('hex') + path.extname(file.originalname);
    cb(null, nombreDisco);
  }
});
const upload = multer({ storage, limits: { fileSize: TAMANO_MAXIMO } });

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
      margin-bottom: 16px;
    }
    h1 { font-size: 18px; font-weight: 600; margin: 0 0 4px; color: #fff; }
    h2 { font-size: 15px; font-weight: 600; margin: 0 0 10px; color: #fff; }
    .subtitulo { font-size: 13px; color: #8b8fa3; margin: 0 0 16px; }
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
    textarea:focus { border-color: #5b6bf5; }
    .botones { display: flex; gap: 10px; margin-top: 14px; }
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
    button:disabled { opacity: 0.5; cursor: default; }
    .btn-primario { background: #5b6bf5; color: #fff; }
    .btn-secundario { background: #2a2e42; color: #e8e9ed; }
    .estado { display: block; text-align: center; margin-top: 12px; font-size: 13px; color: #6ee7a0; min-height: 16px; }
    .login-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; width: 100%; }
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
    .archivo-info {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #14161f;
      border: 1px solid #2a2e42;
      border-radius: 12px;
      padding: 12px 14px;
      font-size: 14px;
    }
    .archivo-nombre { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 10px; }
    .archivo-vacio { font-size: 13px; color: #8b8fa3; text-align: center; padding: 10px 0; }
    input[type="file"] { display: none; }
    .label-subir {
      display: block;
      text-align: center;
      background: #2a2e42;
      color: #e8e9ed;
      border-radius: 12px;
      padding: 13px 10px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 10px;
    }
  </style>
`;

app.get('/login', (req, res) => {
  res.send(`
    <html>
      <head><meta name="viewport" content="width=device-width, initial-scale=1" />${estilos}</head>
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
      <head><meta name="viewport" content="width=device-width, initial-scale=1" />${estilos}</head>
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
      <head><meta name="viewport" content="width=device-width, initial-scale=1" />${estilos}</head>
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

          <div class="card">
            <h2>Archivo</h2>
            <div id="zonaArchivo"></div>
            <label class="label-subir" for="inputArchivo">Subir archivo (máx. 100 MB)</label>
            <input type="file" id="inputArchivo" />
            <span id="estadoArchivo" class="estado"></span>
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

          // --- Archivo ---
          const zonaArchivo = document.getElementById('zonaArchivo');
          const inputArchivo = document.getElementById('inputArchivo');
          const estadoArchivo = document.getElementById('estadoArchivo');

          function mostrarEstadoArchivo(msg) {
            estadoArchivo.textContent = msg;
            setTimeout(() => { estadoArchivo.textContent = ''; }, 2000);
          }

          function formatoTamano(bytes) {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
          }

          function pintarArchivo(info) {
            if (!info) {
              zonaArchivo.innerHTML = '<div class="archivo-vacio">No hay archivo disponible</div>';
              return;
            }
            zonaArchivo.innerHTML =
              '<div class="archivo-info">' +
                '<span class="archivo-nombre">' + info.nombre + ' (' + formatoTamano(info.tamano) + ')</span>' +
                '<button class="btn-primario" style="flex:none; padding:8px 14px;" onclick="window.location.href=\\'/descargar\\'">Descargar</button>' +
              '</div>';
          }

          let ultimoArchivoNombreDisco = null;

          async function refrescarArchivo() {
            const res = await fetch('/archivo');
            const datos = await res.json();
            const nombreDisco = datos.archivo ? datos.archivo.nombreDisco : null;
            if (nombreDisco !== ultimoArchivoNombreDisco) {
              ultimoArchivoNombreDisco = nombreDisco;
              pintarArchivo(datos.archivo);
            }
          }

          inputArchivo.addEventListener('change', async () => {
            const archivo = inputArchivo.files[0];
            if (!archivo) return;
            const formData = new FormData();
            formData.append('archivo', archivo);
            mostrarEstadoArchivo('Subiendo...');
            try {
              const res = await fetch('/subir', { method: 'POST', body: formData });
              if (!res.ok) throw new Error('error');
              mostrarEstadoArchivo('Archivo subido');
              await refrescarArchivo();
            } catch (e) {
              mostrarEstadoArchivo('Error al subir');
            }
            inputArchivo.value = '';
          });

          setInterval(refrescar, 2000);
          setInterval(refrescarArchivo, 2000);
          refrescarArchivo();
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
  reiniciarExpiracionTexto();
  res.json({ ok: true });
});

app.get('/texto', (req, res) => {
  if (!estaAutenticado(req)) {
    return res.status(401).json({ error: 'no autenticado' });
  }
  res.json({ texto: textoGuardado });
});

app.post('/subir', (req, res) => {
  if (!estaAutenticado(req)) {
    return res.status(401).json({ error: 'no autenticado' });
  }
  upload.single('archivo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'no se recibio archivo' });
    }
    borrarArchivoActual();
    archivoActual = {
      nombreOriginal: req.file.originalname,
      nombreDisco: req.file.filename,
      tamano: req.file.size
    };
    reiniciarExpiracionArchivo();
    res.json({ ok: true });
  });
});

app.get('/archivo', (req, res) => {
  if (!estaAutenticado(req)) {
    return res.status(401).json({ error: 'no autenticado' });
  }
  if (!archivoActual) {
    return res.json({ archivo: null });
  }
  res.json({
    archivo: {
      nombre: archivoActual.nombreOriginal,
      nombreDisco: archivoActual.nombreDisco,
      tamano: archivoActual.tamano
    }
  });
});

app.get('/descargar', (req, res) => {
  if (!estaAutenticado(req)) {
    return res.redirect('/login');
  }
  if (!archivoActual) {
    return res.status(404).send('No hay archivo disponible');
  }
  const ruta = path.join(CARPETA_UPLOADS, archivoActual.nombreDisco);
  res.download(ruta, archivoActual.nombreOriginal);
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});