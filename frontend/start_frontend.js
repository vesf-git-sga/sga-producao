const express = require('express');
const path = require('path');
const app = express();

const PORT = 3000;
const HOST = '0.0.0.0'; // Ouve em todas as placas de rede

// Define onde está a pasta build
const buildPath = path.join(__dirname, 'build');
console.log('Servindo arquivos da pasta:', buildPath);

// Serve os arquivos estáticos
app.use(express.static(buildPath));

// CORREÇÃO AQUI: Usamos Regex /.*/ em vez de string '*' para compatibilidade
app.get(/.*/, function (req, res) {
  res.sendFile(path.join(buildPath, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Frontend rodando em http://${HOST}:${PORT}`);
});