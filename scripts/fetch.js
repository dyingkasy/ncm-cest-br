import fetch from "node-fetch";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname       = dirname(fileURLToPath(import.meta.url));
const SUPPLEMENT_PATH = join(__dirname, "../data/ncm-supplement.json");
const OFFICIAL_CACHE  = join(__dirname, "../data/ncm-official-cache.json");

const SISCOMEX_URL =
  "https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json";
const BRASILAPI_URL = "https://brasilapi.com.br/api/ncm/v1";

const norm  = (c) => String(c).replace(/\./g, "");
const is8   = (c) => /^\d{8}$/.test(norm(c));

async function fetchSiscomex() {
  console.log("⏳ Buscando tabela oficial Siscomex...");
  const res = await fetch(SISCOMEX_URL, {
    headers: { Accept: "application/json", "User-Agent": "ncm-cest-br/1.0" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Siscomex HTTP ${res.status}`);
  const json = await res.json();

  const ato     = json.Ato || "";
  const updated = json.Data_Ultima_Atualizacao_NCM || "";
  const leaves  = (json.Nomenclaturas || [])
    .filter((e) => is8(e.Codigo))
    .map((e) => ({
      codigo:      norm(e.Codigo),
      descricao:   e.Descricao ?? "",
      data_inicio: e.Data_Inicio ?? "",
      data_fim:    e.Data_Fim ?? "",
      tipo_ato:    e.Tipo_Ato_Ini ?? "",
      numero_ato:  e.Numero_Ato_Ini ?? "",
      ano_ato:     e.Ano_Ato_Ini ?? "",
    }));

  console.log(`✅ ${leaves.length} NCMs (Siscomex ${updated}, ${ato})`);

  // Cache official code set for validate-ncm.js (avoids second API call)
  writeFileSync(OFFICIAL_CACHE, JSON.stringify({
    cached_at: new Date().toISOString(),
    ato, updated,
    codes: leaves.map((e) => e.codigo),
  }), "utf-8");

  return { leaves, ato, updated };
}

async function fetchBrasilAPI() {
  console.log("⏳ Fallback: buscando BrasilAPI...");
  const res = await fetch(BRASILAPI_URL);
  if (!res.ok) throw new Error(`BrasilAPI HTTP ${res.status}`);
  const data = await res.json();
  const leaves = data
    .filter((i) => is8(i.codigo ?? i.code ?? ""))
    .map((i) => ({
      codigo:      norm(i.codigo ?? i.code ?? ""),
      descricao:   i.descricao ?? i.description ?? "",
      data_inicio: i.data_inicio ?? "",
      data_fim:    i.data_fim ?? "",
      tipo_ato:    i.tipo_ato ?? "",
      numero_ato:  i.numero_ato ?? "",
      ano_ato:     i.ano_ato ?? "",
    }));
  console.log(`✅ ${leaves.length} NCMs (BrasilAPI fallback)`);
  return { leaves, ato: "BrasilAPI", updated: new Date().toISOString() };
}

function loadSupplement() {
  if (!existsSync(SUPPLEMENT_PATH)) return [];
  return JSON.parse(readFileSync(SUPPLEMENT_PATH, "utf-8")).ncms || [];
}

function mergeWithSupplement(official, supplement) {
  const officialSet = new Set(official.map((e) => e.codigo));
  const map = new Map(official.map((e) => [e.codigo, e]));

  let added = 0;
  let enriched = 0;

  for (const sup of supplement) {
    if (!is8(sup.codigo)) continue;
    const key = norm(sup.codigo);

    // Only supplement codes that exist in official table
    if (!officialSet.has(key)) {
      console.warn(`  ⚠️  Suplemento ignorado (não oficial): ${key}`);
      continue;
    }

    const existing = map.get(key);
    if (sup.descricao.length > existing.descricao.length) {
      map.set(key, { ...existing, descricao: sup.descricao });
      enriched++;
    }
  }

  console.log(`✏️  ${enriched} descrições enriquecidas pelo suplemento.`);

  return Array.from(map.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));
}

async function main() {
  try {
    let source;
    try {
      source = await fetchSiscomex();
    } catch (e) {
      console.warn(`⚠️  Siscomex indisponível (${e.message}), usando BrasilAPI...`);
      source = await fetchBrasilAPI();
    }

    const supplement = loadSupplement();
    const merged     = mergeWithSupplement(source.leaves, supplement);

    const output = {
      ultima_atualizacao: new Date().toISOString(),
      total: merged.length,
      fonte: `Siscomex — ${source.ato} (vigente ${source.updated})`,
      ncms: merged,
    };

    mkdirSync("data", { recursive: true });
    writeFileSync("data/ncm.json", JSON.stringify(output, null, 2), "utf-8");
    console.log(`💾 data/ncm.json — ${merged.length} NCMs totais.`);
    console.log(`📅 Atualizado: ${output.ultima_atualizacao}`);
  } catch (err) {
    console.error("❌ Erro:", err.message);
    process.exit(1);
  }
}

main();
