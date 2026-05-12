import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const ncmData  = JSON.parse(readFileSync(join(__dirname, '../data/ncm.json'), 'utf-8'));
const cestData = JSON.parse(readFileSync(join(__dirname, '../data/cest.json'), 'utf-8'));

const allNCMs  = (ncmData.ncms  || []).filter(i => /^\d{8}$/.test(i.codigo.replace(/\./g, '')));
const allCESTs = cestData.cest || [];

const norm = c => c.replace(/\./g, '');

function cestFor(ncmCode) {
  const digits = norm(ncmCode);
  return allCESTs.filter(c => c.ncm_prefixos?.some(p => digits.startsWith(p)));
}

function fmtCEST(c) {
  return c.length === 7 ? `${c.slice(0,2)}.${c.slice(2,5)}.${c.slice(5,7)}` : c;
}

// GET /api/ncm/search?q=...&limit=50
app.get('/api/ncm/search', (req, res) => {
  const q     = (req.query.q || '').toLowerCase().trim();
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  if (!q) return res.json({ sucesso: true, total: 0, data: [] });

  const isNum = /^[\d.]+$/.test(q);
  const digits = norm(q);

  const data = allNCMs.filter(i =>
    isNum
      ? norm(i.codigo).includes(digits)
      : norm(i.codigo).includes(digits) || i.descricao.toLowerCase().includes(q)
  ).slice(0, limit);

  res.json({ sucesso: true, total: data.length, data });
});

// GET /api/ncm/:codigo
app.get('/api/ncm/:codigo', (req, res) => {
  const code = norm(req.params.codigo);
  const ncm  = allNCMs.find(i => norm(i.codigo) === code);
  if (!ncm) return res.status(404).json({ sucesso: false, erro: 'NCM não encontrado' });

  res.json({
    sucesso: true,
    data: { ...ncm, codigo: norm(ncm.codigo), cest_relacionado: cestFor(ncm.codigo) }
  });
});

// GET /api/cest/search?q=...
app.get('/api/cest/search', (req, res) => {
  const q     = (req.query.q || '').toLowerCase().trim();
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  if (!q) return res.json({ sucesso: true, total: 0, data: [] });

  const data = allCESTs.filter(i =>
    i.codigo.includes(q) ||
    i.descricao.toLowerCase().includes(q) ||
    (i.segmento || '').toLowerCase().includes(q)
  ).slice(0, limit);

  res.json({ sucesso: true, total: data.length, data });
});

// GET /api/cest/:codigo
app.get('/api/cest/:codigo', (req, res) => {
  const code = norm(req.params.codigo);
  const cest = allCESTs.find(c => c.codigo === code);
  if (!cest) return res.status(404).json({ sucesso: false, erro: 'CEST não encontrado' });
  res.json({ sucesso: true, data: cest });
});

// GET /api/ncm-cest/:ncm
app.get('/api/ncm-cest/:ncm', (req, res) => {
  const code = norm(req.params.ncm);
  const ncm  = allNCMs.find(i => norm(i.codigo) === code);
  if (!ncm) return res.status(404).json({ sucesso: false, erro: 'NCM não encontrado' });

  const cests = cestFor(ncm.codigo).map(c => ({
    codigo: c.codigo,
    codigo_fmt: fmtCEST(c.codigo),
    descricao: c.descricao,
    segmento: c.segmento
  }));

  res.json({
    sucesso: true,
    data: {
      ncm: { ...ncm, codigo: code },
      cest: cests
    }
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀  API NCM/CEST → http://localhost:${PORT}\n`);
  console.log('  GET /api/ncm/search?q=notebook');
  console.log('  GET /api/ncm/:codigo');
  console.log('  GET /api/cest/search?q=eletronico');
  console.log('  GET /api/cest/:codigo');
  console.log('  GET /api/ncm-cest/:ncm\n');
});
