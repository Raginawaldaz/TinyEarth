import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import savesRouter from './routes/saves.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use('/api/saves', savesRouter);

app.use('/vendor/three', express.static(path.join(__dirname, '../node_modules/three')));

app.use(express.static(path.join(__dirname, '../frontend')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`TinyEarth running at http://localhost:${PORT}`);
});
