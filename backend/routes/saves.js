import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAVES_DIR = path.join(__dirname, '../data/saves');

async function ensureSavesDir() {
  await fs.mkdir(SAVES_DIR, { recursive: true });
}

const router = Router();

router.get('/', async (_req, res) => {
  try {
    await ensureSavesDir();
    const files = await fs.readdir(SAVES_DIR);
    const saves = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const raw = await fs.readFile(path.join(SAVES_DIR, file), 'utf-8');
      const data = JSON.parse(raw);
      saves.push({
        id: file.replace('.json', ''),
        name: data.name || 'Untitled',
        savedAt: data.savedAt,
        year: data.state?.year,
        dayOfYear: data.state?.dayOfYear,
      });
    }

    saves.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    res.json(saves);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const filePath = path.join(SAVES_DIR, `${req.params.id}.json`);
    const raw = await fs.readFile(filePath, 'utf-8');
    res.json(JSON.parse(raw));
  } catch {
    res.status(404).json({ error: 'Save not found' });
  }
});

router.post('/', async (req, res) => {
  try {
    await ensureSavesDir();
    const { name, state } = req.body;
    if (!state) {
      return res.status(400).json({ error: 'Missing state' });
    }

    const id = `save_${Date.now()}`;
    const payload = {
      id,
      name: name || `Earth ${new Date().toLocaleString()}`,
      savedAt: new Date().toISOString(),
      state,
    };

    await fs.writeFile(
      path.join(SAVES_DIR, `${id}.json`),
      JSON.stringify(payload, null, 2),
      'utf-8'
    );

    res.status(201).json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await fs.unlink(path.join(SAVES_DIR, `${req.params.id}.json`));
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Save not found' });
  }
});

export default router;
