// Prepara la base LOCAL de pruebas: usuario gv, equipo aprobado y datos de GV.
// Uso: node tests/qa/preparar.mjs   (API local ya levantada, base ya sembrada)
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { API, CLAVE, ESTADO, env } from "./comun.mjs";

const url = env.DATABASE_URL.replace(/\?.*/, "");
if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname))
  throw new Error("La base no es local.");
const psql = (sql) =>
  execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-c", sql], {
    encoding: "utf8",
  });
// Usuario gv con la misma clave y PIN de la semilla local.
psql(`insert into "User"(id,name,email,"passwordHash","pinHash","roleId","branchId","updatedAt")
 select gen_random_uuid(),'Clary GV','gv@fitstore.demo',u."passwordHash",u."pinHash",
   (select id from "Role" where name='gv'),u."branchId",now()
 from "User" u where u.email='admin@fitstore.demo'
 on conflict (email) do nothing`);

async function http(path, { method = "GET", body, token } = {}) {
  const r = await fetch(API + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: "Bearer " + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  if (!r.ok)
    throw new Error(method + " " + path + " " + r.status + " " + t.slice(0, 300));
  return t ? JSON.parse(t) : null;
}
const login = await http("/api/auth/login", {
  method: "POST",
  body: { email: "admin@fitstore.demo", password: CLAVE },
});
const token = login.accessToken;
const terminal = {
  id: randomUUID(),
  name: "QA recorrido",
  secret: "qa-recorrido-" + randomUUID(),
};
const reg = await http("/api/terminals/register", {
  method: "POST",
  token,
  body: terminal,
});
if (reg?.status === "pending")
  await http("/api/terminals/" + terminal.id + "/approve", {
    method: "POST",
    token,
    body: {},
  });

const hoy = new Date();
const dia = (n) =>
  new Date(hoy.getTime() + n * 86400000).toISOString().slice(0, 10);
const hora = (n, h = 15) => dia(n) + "T" + h + ":00:00-04:00";
const pago = (key, n, amount, concept, method = "efectivo") => ({
  key,
  date: dia(n),
  amount,
  concept,
  method,
  bank: method === "transferencia" ? "Banreservas" : null,
  reference: method === "transferencia" ? "QA-" + key : null,
  verified: method !== "transferencia",
});
const imp = await http("/api/gv/import", {
  method: "POST",
  token,
  body: {
    courses: [
      { key: "c1", name: "Automaquillaje octubre", type: "automaquillaje", date: dia(5), price: 6500, capacity: 12 },
      { key: "c2", name: "Brazilian Glam", type: "brazilian", date: dia(-3), price: 9000, capacity: 8 },
    ],
    enrollments: [
      { key: "e1", courseKey: "c1", clientName: "Lucía Méndez", phone: "8095550001", agreedPrice: 6500, status: "activa", payments: [pago("p1", -2, 2000, "separo"), pago("p2", -1, 1500, "segundo", "transferencia")] },
      { key: "e2", courseKey: "c1", clientName: "Sofía Martínez", agreedPrice: 6500, status: "activa", payments: [pago("p3", -1, 6500, "separo")] },
      { key: "e3", courseKey: "c2", clientName: "Paola Fernández", agreedPrice: 9000, status: "cancelada", payments: [] },
    ],
    appointments: [
      { key: "a1", date: hora(1), clientName: "Daniela Pérez", service: "glam", artists: ["Génesis"], total: 4500, status: "agendada", payments: [pago("p4", 0, 1000, "separo")] },
      { key: "a2", date: hora(-2), clientName: "Isabella Cruz", service: "novia", artists: ["Maryori", "Camila"], total: 12000, status: "realizada", payments: [] },
    ],
    leads: [
      { key: "l1", name: "Valentina Ramos", phone: "8095550002", interest: "Automaquillaje", status: "por_contactar" },
      { key: "l2", name: "Laura Santana", interest: "Brazilian", status: "contactada" },
    ],
  },
});
writeFileSync(ESTADO, JSON.stringify({ terminal }));
console.log("Preparado: equipo aprobado y datos de GV.", JSON.stringify(imp).slice(0, 200));
