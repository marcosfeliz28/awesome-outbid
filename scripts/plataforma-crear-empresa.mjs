#!/usr/bin/env node
// Crea una empresa piloto por invitación (operador de la plataforma).
// El token se genera una vez: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" (64 caracteres o más).
// Uso: NEXORA_PLATFORM_URL=https://... NEXORA_PLATFORM_TOKEN=... \
//   node scripts/plataforma-crear-empresa.mjs --nombre "Tienda X" --codigo tienda-x \
//   --tipo retail --plan basico --dias 30 --admin "Ana Pérez" --correo ana@ejemplo.com
// Sin argumentos de empresa (--listar) muestra las empresas. Nunca imprime el token.
// Paquete de IA ya pagado (solo suma al mes en curso): --paquete-ia tienda-x --tamano 100|300 --ref "Transferencia 123"
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: {
  nombre: { type: "string" }, codigo: { type: "string" }, tipo: { type: "string", default: "general" },
  plan: { type: "string", default: "autoservicio" }, dias: { type: "string", default: "30" },
  admin: { type: "string" }, correo: { type: "string" }, listar: { type: "boolean", default: false },
  "paquete-ia": { type: "string" }, tamano: { type: "string" }, ref: { type: "string" },
} });
const base = process.env.NEXORA_PLATFORM_URL?.trim().replace(/\/+$/, "");
const token = process.env.NEXORA_PLATFORM_TOKEN?.trim();
if (!base || !token) {
  console.error("Faltan NEXORA_PLATFORM_URL o NEXORA_PLATFORM_TOKEN en el entorno.");
  process.exit(2);
}
const headers = { Authorization: `Platform ${token}`, "Content-Type": "application/json" };
const pack = values["paquete-ia"];
const response = pack
  ? await fetch(`${base}/api/platform/tenants/${encodeURIComponent(pack)}/ai-packs`, { method: "POST", headers,
    body: JSON.stringify({ size: Number(values.tamano), reference: values.ref }) })
  : values.listar
  ? await fetch(`${base}/api/platform/tenants`, { headers })
  : await fetch(`${base}/api/platform/tenants`, { method: "POST", headers, body: JSON.stringify({
    businessName: values.nombre, companyCode: values.codigo, businessType: values.tipo,
    plan: values.plan, trialDays: Number(values.dias), adminName: values.admin, adminEmail: values.correo,
  }) });
const body = await response.json().catch(() => ({}));
if (!response.ok) {
  console.error(`Error ${response.status}: ${body.message ?? "sin detalle"}`);
  process.exit(1);
}
if (pack) console.log(`Paquete de ${body.questions} preguntas (RD$${body.priceDop}) acreditado a ${pack} para ${body.month}. Usadas ${body.usage.used} de ${body.usage.limit}.`);
else if (values.listar) console.table(body);
else {
  console.log(`Empresa creada: ${body.slug} (plan ${body.plan}, prueba hasta ${body.trialEndsAt}).`);
  console.log("Envía este enlace a la administradora (vence en 7 días, un solo uso):");
  console.log(body.invitationUrl);
}
