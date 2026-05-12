import fetch from "node-fetch";
import { writeFileSync, mkdirSync } from "fs";

const BRASILAPI_NCM = "https://brasilapi.com.br/api/ncm/v1";

async function fetchNCM() {
  console.log("⏳ Buscando NCMs na BrasilAPI...");
  const res = await fetch(BRASILAPI_NCM);
  if (!res.ok) throw new Error(`Erro ao buscar NCMs: ${res.status}`);
  const data = await res.json();
  console.log(`✅ ${data.length} NCMs encontrados.`);
  return data;
}

async function main() {
  try {
    const ncms = await fetchNCM();

    // Normalize fields
    const normalized = ncms.map((item) => ({
      codigo: item.codigo ?? item.code ?? "",
      descricao: item.descricao ?? item.description ?? "",
      data_inicio: item.data_inicio ?? "",
      data_fim: item.data_fim ?? "",
      tipo_ato: item.tipo_ato ?? "",
      numero_ato: item.numero_ato ?? "",
      ano_ato: item.ano_ato ?? "",
    }));

    const output = {
      ultima_atualizacao: new Date().toISOString(),
      total: normalized.length,
      fonte: "BrasilAPI (https://brasilapi.com.br)",
      ncms: normalized,
    };

    mkdirSync("data", { recursive: true });
    writeFileSync("data/ncm.json", JSON.stringify(output, null, 2), "utf-8");
    console.log("💾 Dados salvos em data/ncm.json");
    console.log(`📅 Última atualização: ${output.ultima_atualizacao}`);
  } catch (err) {
    console.error("❌ Erro:", err.message);
    process.exit(1);
  }
}

main();
