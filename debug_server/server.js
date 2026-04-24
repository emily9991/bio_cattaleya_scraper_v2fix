// debug_server/server.js
const express = require('express');
const app = express();
app.use(express.json());
app.use((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
});

const logs = [];

app.options('/log', (req, res) => res.sendStatus(200));

app.post('/log', (req, res) => {
  const entry = {
    ts: new Date().toISOString(),
    ...req.body
  };
  logs.push(entry);
  const tag = entry.level === 'error' ? 'â' : entry.level === 'warn' ? 'â' : 'â';
  console.log(`${tag} [${entry.source}] ${entry.msg}`, entry.data ? JSON.stringify(entry.data).slice(0,200) : '');
  res.json({ ok: true });
});

app.get('/logs', (req, res) => res.json(logs));

app.get('/clear', (req, res) => { logs.length = 0; res.json({ cleared: true }); });

app.listen(5001, () => console.log('ð BSC Debug Server en http://localhost:5001'));
