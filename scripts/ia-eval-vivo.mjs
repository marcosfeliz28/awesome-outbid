#!/usr/bin/env node
// Evaluación EN VIVO de «Pregúntale a Nexora»: repite las 129 preguntas de la
// auditoría del 25-oct-2026 (empresa aud-ia) y las califica contra la verdad
// guardada en scripts/ia-eval-verdad.json. Solo después de desplegar; gasta
// cuota real de IA (una pregunta por consulta).
//
// Variables (nunca se imprimen):
//   NEXORA_URL               https://nexorapos.net (por defecto)
//   NEXORA_EMPRESA           código de la empresa (aud-ia por defecto)
//   NEXORA_IA_USUARIO        usuario o correo de la dueña de esa empresa
//   NEXORA_IA_CLAVE          su contraseña
//   NEXORA_IA_CAJERA_USUARIO / NEXORA_IA_CAJERA_CLAVE  (opcional) para las
//                            preguntas de cajera; sin ellas se usan las de la dueña
//   NEXORA_IA_FECHA          fecha de los datos (2026-10-25); otro día se le
//                            indica al asistente que «hoy» es esa fecha
//   NEXORA_IA_PAUSA_MS       pausa entre preguntas (13000: límite de 5 por minuto)
//   NEXORA_IA_SOLO           ids separados por coma para repetir solo esas
//   NEXORA_IA_SALIDA         archivo JSONL de resultados (ia-eval-vivo-resultados.jsonl)
//
// Sin red: `node scripts/ia-eval-vivo.mjs --calificar respuestas.jsonl` vuelve a
// calificar respuestas guardadas ({i|id, status|estado, answer|respuesta, proposal}).
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const env = process.env;
const BASE = (env.NEXORA_URL || "https://nexorapos.net").replace(/\/+$/, "");
const COMPANY = env.NEXORA_EMPRESA || "aud-ia";
const DATE = env.NEXORA_IA_FECHA || "2026-10-25";
const PAUSE = Number(env.NEXORA_IA_PAUSA_MS || 13000);
const OUT = env.NEXORA_IA_SALIDA || "ia-eval-vivo-resultados.jsonl";
const ONLY = new Set(
  (env.NEXORA_IA_SOLO || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);
const questions = JSON.parse(
  readFileSync(join(here, "ia-eval-preguntas.json"), "utf8"),
);
const truth = JSON.parse(
  readFileSync(join(here, "ia-eval-verdad.json"), "utf8"),
);

// Moneda ajena, IVA, otra empresa, rutas internas o «no tengo herramienta».
const FORBIDDEN = [
  "₡",
  "\\bq ?\\d",
  "c\\$",
  "(?<!rd)\\$ ?\\d",
  "\\biva\\b",
  "nexora-demo",
  "no tengo (una )?herramienta",
  "quedo incompleta",
  "/api/",
];
const TIME_WORDS =
  /\b(hoy|oy|ayer|semana|mes|vamos|ventas?|vend\w*|bend\w*|factur\w*|caja|cuadre|anulaci\w*|descuent\w*|transferencias?|gan[eé]|ganancia|margen|itbis|hora|categor\w*|comisi\w*|faltó|efectivo|tarjeta|cr[eé]dito)\b/i;

const fold = (text) =>
  String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // 13,628.00 → 13628.00 para comparar números.
    .replace(/(\d)[,](?=\d{3}(?:\D|$))/g, "$1")
    .replace(/(\d)[,](?=\d{3}(?:\D|$))/g, "$1");
const valueAt = (path) =>
  path.split(".").reduce((item, key) => item?.[key], truth);
const pattern = (text) =>
  fold(text.replace(/\{([^}]+)\}/g, (_, path) => String(valueAt(path) ?? "?")));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const today = new Date().toLocaleDateString("en-CA", {
  timeZone: "America/Santo_Domingo",
});
const longDate = new Date(DATE + "T16:00:00Z").toLocaleDateString("es-DO", {
  timeZone: "America/Santo_Domingo",
  day: "numeric",
  month: "long",
  year: "numeric",
});

async function request(method, path, { token, body } = {}) {
  const started = Date.now();
  const response = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Id": COMPANY,
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: response.status, body: json, ms: Date.now() - started };
}
async function login(user, password, label) {
  if (!user || !password) return null;
  const response = await request("POST", "/api/auth/login", {
    body: { login: user, password },
  });
  if (response.status >= 300 || !response.body?.accessToken)
    throw new Error(
      `No se pudo entrar como ${label} (HTTP ${response.status}).`,
    );
  return response.body.accessToken;
}

function grade(item, response) {
  const reasons = [];
  if (item.estado)
    return response.status === item.estado
      ? { verdict: "correcta", reasons }
      : { verdict: "incorrecta", reasons: [`HTTP ${response.status}`] };
  if (response.status !== 201 && response.status !== 200)
    return { verdict: "error", reasons: [`HTTP ${response.status}`] };
  const answer = fold(response.body?.answer);
  for (const rule of item.debe ?? [])
    if (!new RegExp(pattern(rule)).test(answer)) reasons.push("falta " + rule);
  const allowed = new Set(item.permitir ?? []);
  for (const rule of [
    ...FORBIDDEN.filter((rule) => !allowed.has(rule)),
    ...(item.noDebe ?? []),
  ])
    if (new RegExp(rule).test(answer)) reasons.push("no debe decir " + rule);
  if (item.propuesta && !response.body?.proposal)
    reasons.push("sin propuesta de anulación");
  if (reasons.length) return { verdict: "incorrecta", reasons };
  return {
    verdict:
      item.debe || item.propuesta || item.noDebe ? "correcta" : "revisar",
    reasons,
  };
}

async function main() {
  const owner = await login(
    env.NEXORA_IA_USUARIO,
    env.NEXORA_IA_CLAVE,
    "dueña",
  );
  if (!owner) throw new Error("Faltan NEXORA_IA_USUARIO y NEXORA_IA_CLAVE.");
  const cashier =
    (await login(
      env.NEXORA_IA_CAJERA_USUARIO,
      env.NEXORA_IA_CAJERA_CLAVE,
      "cajera",
    )) ?? owner;
  const before = await request("GET", "/api/assistant/usage", { token: owner });
  console.log(
    `Empresa ${COMPANY} en ${BASE}. Cuota antes: ${before.body?.usadas ?? "?"} de ${before.body?.limite ?? "?"}.`,
  );
  if (today !== DATE)
    console.log(
      `Hoy no es ${DATE}: las preguntas con fechas relativas llevan la fecha de los datos.`,
    );
  if (!ONLY.size) writeFileSync(OUT, "");
  const counts = { correcta: 0, incorrecta: 0, revisar: 0, error: 0 };
  for (const item of questions) {
    if (ONLY.size && !ONLY.has(item.id)) continue;
    const messages = item.mensajes ?? [
      { role: "user", content: item.pregunta },
    ];
    if (today !== DATE) {
      const last = messages.at(-1);
      if (TIME_WORDS.test(last.content) && last.content.length < 400)
        messages[messages.length - 1] = {
          ...last,
          content: `(Toma el ${longDate} como «hoy».) ${last.content}`,
        };
    }
    const token = item.rol === "cajera" ? cashier : owner;
    let response = await request("POST", "/api/assistant/ask", {
      token,
      body: { messages },
    });
    if (
      response.status === 429 &&
      !String(response.body?.message ?? "").startsWith("Llegaste a tu límite")
    ) {
      await sleep(60000);
      response = await request("POST", "/api/assistant/ask", {
        token,
        body: { messages },
      });
    }
    const { verdict, reasons } = grade(item, response);
    counts[verdict]++;
    appendFileSync(
      OUT,
      JSON.stringify({
        id: item.id,
        rol: item.rol,
        pregunta: item.pregunta ?? JSON.stringify(item.mensajes),
        esperado: item.esperado,
        estado: response.status,
        ms: response.ms,
        respuesta:
          response.body?.answer ?? response.body?.message ?? response.body,
        propuesta: response.body?.proposal,
        restantes: response.body?.remaining,
        veredicto: verdict,
        motivos: reasons,
      }) + "\n",
    );
    console.log(
      `${item.id.padStart(8)} ${verdict.padEnd(10)} ${(response.ms / 1000).toFixed(1)}s ${reasons.join("; ")}`,
    );
    await sleep(PAUSE);
  }
  const after = await request("GET", "/api/assistant/usage", { token: owner });
  const graded = counts.correcta + counts.incorrecta + counts.error;
  console.log(
    `\nCorrectas ${counts.correcta} · incorrectas ${counts.incorrecta} · errores ${counts.error} · revisar a mano ${counts.revisar}`,
  );
  console.log(
    `Exactitud automática: ${graded ? ((counts.correcta / graded) * 100).toFixed(1) : "0"} % de ${graded} calificables.`,
  );
  console.log(
    `Cuota después: ${after.body?.usadas ?? "?"} de ${after.body?.limite ?? "?"}. Resultados en ${OUT}.`,
  );
  process.exitCode = counts.incorrecta + counts.error ? 1 : 0;
}

function regrade(file) {
  const byId = new Map(questions.map((item) => [item.id, item]));
  const counts = { correcta: 0, incorrecta: 0, revisar: 0, error: 0 };
  for (const line of readFileSync(file, "utf8").split("\n").filter(Boolean)) {
    const row = JSON.parse(line);
    const item = byId.get(String(row.id ?? row.i));
    if (!item) continue;
    const { verdict, reasons } = grade(item, {
      status: row.estado ?? row.status,
      body: {
        answer: row.respuesta ?? row.answer,
        message: row.respuesta ?? row.answer,
        proposal: row.propuesta ?? row.proposal,
      },
    });
    counts[verdict]++;
    if (verdict !== "correcta")
      console.log(
        `${item.id.padStart(8)} ${verdict.padEnd(10)} ${reasons.join("; ")}`,
      );
  }
  console.log(JSON.stringify(counts));
}

if (process.argv[2] === "--calificar") regrade(process.argv[3]);
else
  main().catch((error) => {
    // Solo el mensaje: nunca encabezados ni credenciales.
    console.error(
      "Error: " + (error instanceof Error ? error.message : String(error)),
    );
    process.exitCode = 2;
  });
