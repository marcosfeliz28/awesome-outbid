#!/usr/bin/env node
// Crea una empresa piloto por invitación (operador de la plataforma).
// El token se genera una vez: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" (64 caracteres o más).
// Uso: NEXORA_PLATFORM_URL=https://... NEXORA_PLATFORM_TOKEN=... \
//   node scripts/plataforma-crear-empresa.mjs --nombre "Tienda X" --codigo tienda-x \
//   --tipo retail --plan basico --dias 30 --admin "Ana Pérez" --correo ana@ejemplo.com
// Sin argumentos de empresa (--listar) muestra las empresas. Nunca imprime el token.
// Cobro manual (PC-23): --pago tienda-x --monto 2000 --metodo transferencia --ref "BHD 123" --meses 1
//   (o --anual en vez de --meses; métodos: transferencia, efectivo, tarjeta, mensajero).
//   --pagos tienda-x muestra la bitácora de pagos de esa empresa.
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: {
  nombre: { type: "string" }, codigo: { type: "string" }, tipo: { type: "string", default: "general" },
  plan: { type: "string", default: "autoservicio" }, dias: { type: "string", default: "30" },
  admin: { type: "string" }, correo: { type: "string" }, listar: { type: "boolean", default: false },
  pago: { type: "string" }, monto: { type: "string" }, metodo: { type: "string" }, ref: { type: "string" },
  meses: { type: "string" }, anual: { type: "boolean", default: false }, pagos: { type: "string" },
} });
const methods = { transferencia: "transfer", efectivo: "cash", tarjeta: "card_in_store", mensajero: "courier" };
const base = process.env.NEXORA_PLATFORM_URL?.trim().replace(/\/+$/, "");
const token = process.env.NEXORA_PLATFORM_TOKEN?.trim();
if (!base || !token) {
  console.error("Faltan NEXORA_PLATFORM_URL o NEXORA_PLATFORM_TOKEN en el entorno.");
  process.exit(2);
}
const headers = { Authorization: `Platform ${token}`, "Content-Type": "application/json" };
const slugPath = (slug) => `${base}/api/platform/tenants/${encodeURIComponent(slug)}/payments`;
const response = values.pago
  ? await fetch(slugPath(values.pago), { method: "POST", headers, body: JSON.stringify({
    amount: Number(values.monto), method: methods[values.metodo] ?? values.metodo, reference: values.ref,
    ...(values.anual ? { year: true } : { months: Number(values.meses) }),
  }) })
  : values.pagos
    ? await fetch(slugPath(values.pagos), { headers })
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
if (values.pago) console.log(`Pago registrado: ${body.tenant.slug} activa hasta ${body.tenant.paidUntil} (RD$${body.payment.amount}, ${body.payment.months} mes/es).`);
else if (values.pagos || values.listar) console.table(body);
else {
  console.log(`Empresa creada: ${body.slug} (plan ${body.plan}, prueba hasta ${body.trialEndsAt}).`);
  console.log("Envía este enlace a la administradora (vence en 7 días, un solo uso):");
  console.log(body.invitationUrl);
}
