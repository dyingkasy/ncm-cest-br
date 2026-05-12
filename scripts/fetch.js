import fetch from "node-fetch";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRASILAPI_NCM = "https://brasilapi.com.br/api/ncm/v1";
const SUPPLEMENT_PATH = join(__dirname, "../data/ncm-supplement.json");

async function fetchNCM() {
  console.log("⏳ Buscando NCMs na BrasilAPI...");
  const res = await fetch(BRASILAPI_NCM);
  if (!res.ok) throw new Error(`Erro ao buscar NCMs: ${res.status}`);
  const data = await res.json();
  console.log(`✅ ${data.length} NCMs encontrados na BrasilAPI.`);
  return data;
}

function loadSupplement() {
  if (!existsSync(SUPPLEMENT_PATH)) return [];
  const raw = JSON.parse(readFileSync(SUPPLEMENT_PATH, "utf-8"));
  return raw.ncms || [];
}

const norm = (c) => c.replace(/\./g, "");
const isValid8 = (c) => /^\d{8}$/.test(norm(c));

function mergeNCMs(brasilapi, supplement) {
  const map = new Map();

  // Index BrasilAPI entries first
  for (const item of brasilapi) {
    const entry = {
      codigo: item.codigo ?? item.code ?? "",
      descricao: item.descricao ?? item.description ?? "",
      data_inicio: item.data_inicio ?? "",
      data_fim: item.data_fim ?? "",
      tipo_ato: item.tipo_ato ?? "",
      numero_ato: item.numero_ato ?? "",
      ano_ato: item.ano_ato ?? "",
    };
    if (isValid8(entry.codigo)) {
      map.set(norm(entry.codigo), entry);
    }
  }

  let added = 0;
  let enriched = 0;

  // Merge supplement: add missing + enrich short descriptions
  for (const sup of supplement) {
    if (!isValid8(sup.codigo)) continue;
    const key = norm(sup.codigo);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, { ...sup, codigo: key });
      added++;
    } else if (sup.descricao.length > existing.descricao.length) {
      // Supplement has richer description — keep it
      map.set(key, { ...existing, descricao: sup.descricao });
      enriched++;
    }
  }

  console.log(`➕ ${added} NCMs adicionados do suplemento.`);
  console.log(`✏️  ${enriched} descrições enriquecidas pelo suplemento.`);

  // Sort by code
  return Array.from(map.values()).sort((a, b) =>
    norm(a.codigo).localeCompare(norm(b.codigo))
  );
}

async function main() {
  try {
    const brasilapi = await fetchNCM();
    const supplement = loadSupplement();
    const merged = mergeNCMs(brasilapi, supplement);

    const output = {
      ultima_atualizacao: new Date().toISOString(),
      total: merged.length,
      fonte: "BrasilAPI (https://brasilapi.com.br) + suplemento local",
      ncms: merged,
    };

    mkdirSync("data", { recursive: true });
    writeFileSync("data/ncm.json", JSON.stringify(output, null, 2), "utf-8");
    console.log(`💾 data/ncm.json salvo — ${merged.length} NCMs totais.`);
    console.log(`📅 Atualizado: ${output.ultima_atualizacao}`);
  } catch (err) {
    console.error("❌ Erro:", err.message);
    process.exit(1);
  }
}

main();
