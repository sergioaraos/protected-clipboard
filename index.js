const express = require('express');
const app = express();
const PORT = process.env.PORT || 3020;

app.get('/', (req, res) => {
  res.send('Hola mundo, protected-clipboard funcionando');
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});