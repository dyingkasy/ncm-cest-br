/**
 * Validate data/ncm.json against the official Siscomex table.
 * Removes NCMs not in the official table, logs all changes.
 * Usage: node scripts/validate-ncm.js
 */

import fetch from "node-fetch";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname      = dirname(fileURLToPath(import.meta.url));
const NCM_PATH       = join(__dirname, "../data/ncm.json");
const LOG_PATH       = join(__dirname, "../data/ncm-changes.json");
const OFFICIAL_CACHE = join(__dirname, "../data/ncm-official-cache.json");
const SISCOMEX_URL   =
  "https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json";

const norm = (c) => String(c).replace(/\./g, "");
const is8 = (c) => /^\d{8}$/.test(norm(c));

function loadCachedOfficial() {
  if (!existsSync(OFFICIAL_CACHE)) return null;
  const cache = JSON.parse(readFileSync(OFFICIAL_CACHE, "utf-8"));
  // Cache valid if generated in the last 2 hours
  const age = Date.now() - new Date(cache.cached_at).getTime();
  if (age > 2 * 60 * 60 * 1000) return null;
  console.log(`📂 Usando cache oficial (${cache.ato}, ${cache.updated})`);
  return cache;
}

async function fetchOfficial() {
  // Use cache from fetch.js run if fresh (avoids Siscomex rate limit)
  const cache = loadCachedOfficial();
  if (cache) {
    return {
      leaves: cache.codes.map((c) => ({ Codigo: c })),
      ato: cache.ato,
      updated: cache.updated,
      fromCache: true,
    };
  }

  console.log("⏳ Baixando tabela oficial Siscomex...");
  const res = await fetch(SISCOMEX_URL, {
    headers: { Accept: "application/json", "User-Agent": "ncm-cest-br/1.0" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Siscomex HTTP ${res.status}`);
  const json = await res.json();

  const ato     = json.Ato || "";
  const updated = json.Data_Ultima_Atualizacao_NCM || "";
  const leaves  = (json.Nomenclaturas || []).filter((e) => is8(e.Codigo));

  console.log(`✅ ${leaves.length} NCMs oficiais (${updated}, ${ato})`);
  return { leaves, ato, updated };
}

function loadCurrent() {
  const raw = JSON.parse(readFileSync(NCM_PATH, "utf-8"));
  return raw;
}

function validate(current, officialLeaves) {
  const officialSet = new Map(
    officialLeaves.map((e) => [norm(e.Codigo ?? e.codigo ?? ""), e])
  );

  const kept     = [];
  const removed  = [];
  const updated  = [];

  for (const ncm of current.ncms) {
    const key     = norm(ncm.codigo);
    const oficial = officialSet.get(key);

    if (!oficial) {
      removed.push({
        codigo: key,
        descricao: ncm.descricao,
        motivo: "Não encontrado na tabela oficial Siscomex",
      });
      continue;
    }

    // Check if official has a longer/different description (we may have enriched it)
    const oficialDesc = oficial.Descricao || oficial.descricao || "";
    if (
      oficialDesc &&
      oficialDesc.length > ncm.descricao.length &&
      !ncm.descricao.includes("(") // don't overwrite enriched supplement descriptions
    ) {
      updated.push({
        codigo: key,
        descricao_anterior: ncm.descricao,
        descricao_nova: oficialDesc,
      });
      kept.push({ ...ncm, descricao: oficialDesc });
    } else {
      kept.push(ncm);
    }
  }

  return { kept, removed, updated };
}

async function main() {
  const { leaves, ato, updated: oficialDate } = await fetchOfficial();
  const current = loadCurrent();

  const before = current.ncms.length;
  const { kept, removed, updated } = validate(current, leaves);
  const after  = kept.length;

  // Save cleaned ncm.json
  const output = {
    ...current,
    ultima_atualizacao: new Date().toISOString(),
    total: after,
    fonte: `Siscomex (${ato}) — validado em ${oficialDate}`,
    ncms: kept,
  };
  writeFileSync(NCM_PATH, JSON.stringify(output, null, 2), "utf-8");

  // Save changes log
  const log = {
    data_validacao: new Date().toISOString(),
    fonte_oficial: `Siscomex — ${ato}`,
    vigencia: oficialDate,
    total_antes: before,
    total_depois: after,
    total_removidos: removed.length,
    total_atualizados: updated.length,
    removidos: removed,
    atualizados: updated,
  };
  writeFileSync(LOG_PATH, JSON.stringify(log, null, 2), "utf-8");

  console.log(`\n📊 Validação concluída:`);
  console.log(`   Antes : ${before} NCMs`);
  console.log(`   Depois: ${after} NCMs`);
  console.log(`   ✗ Removidos: ${removed.length}`);
  if (removed.length) removed.forEach((r) => console.log(`      ${r.codigo} — ${r.descricao.substring(0, 60)}`));
  console.log(`   ✏️  Atualizados: ${updated.length}`);
  console.log(`💾 Salvo: data/ncm.json`);
  console.log(`📋 Log  : data/ncm-changes.json`);
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
