# Nexora POS — pedido de propuesta para Gemini

*Preparado por Claude (arquitecto del proyecto) para la dueña · 24 de octubre de 2026*

## Parte 1 — Resumen para la dueña

**Qué es este documento.** Un pedido completo para que Gemini proponga cómo terminar Nexora POS y venderlo. Se lo mandas tal cual. La Parte 2 está en español y la Parte 3 dice lo mismo en inglés; puedes mandar una sola o las dos.

**Qué es Claude en este proyecto.** Claude es un asistente de IA de Anthropic. En Nexora hace de **arquitecto y auditor**: diseña cada fase, escribe las órdenes de trabajo, revisa lo que construyen los demás (código, pruebas, seguridad, dinero) y aprueba o rechaza. Es el único que despliega, y solo con tu permiso. **No construye**: eso lo hacen ChatGPT Nube y ChatGPT PC. Gemini propone y audita de forma independiente.

**Qué pediste hoy:**

1. Terminar Nexora como sistema de facturación que se pueda **descargar, instalar y vender**: en la web, en laptop y conectado a nuestros servidores o a una red.
2. Una **opción con IA** para que cada cliente pregunte como tú le preguntas a Claude: cuadre del fin del día, quién facturó y quién no, cómo cerrar, abrir o corregir una factura, entradas y salidas de mercancía.
3. Que tú puedas **vender soporte con IA** a tus clientes, cobrar por eso y consultar sus datos **sin poder modificar nada**: solo ver y pedir.
4. Que ChatGPT construya y Claude dirija y audite, también de noche.
5. Una propuesta independiente de Gemini (este documento).

**Fases acordadas:**

| Fase | Qué | Quién | Estado |
|---|---|---|---|
| 0 | Varias empresas en un mismo sistema, separadas (0 fugas) | ChatGPT PC | Hecha |
| 1 | Registro, prueba gratis de 14 días, planes, cobro, exportación y respaldo por empresa | ChatGPT PC | Empieza hoy |
| 2 | Asistente «Pregúntale a Nexora» y acceso de soporte de solo lectura | ChatGPT Nube | Después de su auditoría de hoy |
| 3 | Instalador vendible para laptop Windows, actualización automática, licencia y modo sin internet | ChatGPT PC | Después de la fase 1 |
| 4 | Comprobantes fiscales (NCF / e-CF), términos legales, página de venta, cobro real y piloto con 3–5 negocios | Tú + ChatGPT | Pendiente |
| 5 | Funcionar sin internet con sincronización, y apps de celular | ChatGPT | Pendiente |

## Parte 2 — Pedido para Gemini (español)

**Tu rol.** Actúa como arquitecto de software independiente y consultor de producto SaaS para pequeños comercios de República Dominicana. Vas a revisar un plan existente y proponer uno mejor si lo encuentras. No escribas código. Sé concreto: cifras, plazos, riesgos y por qué.

**El producto.** Nexora POS es un sistema de facturación, caja e inventario en español para tiendas pequeñas (hoy lo usa una tienda real de suplementos, fajas y maquillaje con varias cajeras). Tecnología: React + TypeScript + Vite (PWA instalable), API NestJS + Prisma, PostgreSQL 17 en Render, app de escritorio Tauri para Windows, cola de ventas sin conexión en IndexedDB. Tiene: ventas, cajas con apertura, cierre y cuadre con PIN de gerente, anulaciones con aprobación, devoluciones, crédito y contraentrega, transferencias bancarias con verificación, envíos de mensajero, incentivos a vendedoras, 40 reportes, importación de productos desde Excel y lectura de facturas de proveedor con IA, entradas, salidas y traspasos entre almacenes, respaldos cifrados. El código está en GitHub (`marcosfeliz28/awesome-outbid`, ramas `nexora-cloud` para la tienda y `producto-nexora` para el producto).

**Lo que ya está hecho para venderlo.** Multiempresa: cada tabla lleva `tenantId`, doble cerrojo (filtro en el código + Row-Level Security de PostgreSQL) y una matriz automática de pruebas con 0 fugas entre empresas en 152 rutas.

**El plan actual (resumen).**

- Fase 1: registro público, prueba gratis de 14 días, estados del plan (prueba → activo → atrasado con 7 días de gracia → solo lectura; nunca se borran datos), cobro detrás de una interfaz con proveedor de prueba, límites por plan, exportación y respaldo por empresa.
- Fase 2: asistente «Pregúntale a Nexora». El servidor le da al modelo solo herramientas de **lectura** que son las mismas rutas GET de la API, llamadas con el token del usuario que pregunta; así la IA hereda exactamente sus permisos, sucursal y empresa. La IA nunca mueve dinero, inventario ni precios: explica los pasos. La única acción es **pedir** una anulación, que confirma el usuario y aprueba un gerente. Cuota mensual por plan y bitácora de cada consulta. Modelo económico por defecto. Rol `support` de solo lectura que el cliente activa por 24 h o 7 días para que la dueña dé soporte sin poder modificar nada; cada consulta del soporte queda a la vista del cliente.
- Fase 3: instalador Windows firmado, actualización automática, licencia con modo sin internet, primer arranque guiado.
- Fase 4: NCF y e-CF de la DGII, legal, página de venta, cobro real y piloto.
- Fase 5: sin internet completo con sincronización y apps de celular.
- Planes propuestos (RD$/mes): Autoservicio 990 (1 sucursal, 1 caja, 2 usuarios, 30 consultas de IA), Básico 1,990 (50 consultas), Pro 3,990 (300 consultas, soporte prioritario), Premium 7,990 (1,000 consultas). Dos meses gratis pagando el año.

**Qué te pedimos (entrega en este orden):**

1. **Crítica del plan:** qué falta, qué sobra y qué orden cambiarías para vender antes sin arriesgar datos ni dinero. Máximo 10 puntos, del más importante al menos.
2. **IA de soporte:** ¿es seguro y suficiente que la IA use las rutas GET con el token del usuario? ¿Qué ataques ves (inyección de instrucciones desde datos como nombres de clientes o notas, fuga entre empresas, abuso de cuota)? ¿Qué preguntas del día a día de una tienda no cubren esas herramientas? Propón la lista final de herramientas.
3. **Soporte de la dueña sin modificar:** evalúa el rol de solo lectura con acceso temporal y bitácora visible. ¿Cómo lo harías tú? ¿Cómo se cobra ese soporte?
4. **Precios y costos:** calcula el costo mensual por cliente (servidor + IA por consulta + cobro con tarjeta) y el precio mínimo de cada plan para no perder dinero. Compara procesadores de pago que sirvan para un negocio en República Dominicana con suscripciones recurrentes (Azul, CardNET, PayPal, Stripe a través de otra entidad u otros), con comisión y requisitos. Indica de dónde sacas cada precio y su fecha; si no puedes confirmarlo, dilo.
5. **Instalador y licencia:** cómo venderías la versión para laptop: firma de código en Windows, actualización, licencia sin internet, qué pasa si el cliente deja de pagar, base de datos local o en la nube.
6. **Fiscal y legal en R. D.:** qué exige hoy la DGII para facturación electrónica (e-CF) a un software que se vende a terceros, y qué documentos legales necesita el producto.
7. **Tu propuesta de fases** con criterio de terminado medible por fase y estimado de esfuerzo (S/M/L).

**Reglas:** no inventes que algo existe en el código; si no lo verificaste, dilo. No pidas contraseñas ni datos reales de la tienda. Responde en español. Formato: títulos cortos y tablas.

## Parte 3 — Request for Gemini (English)

**Your role.** Act as an independent software architect and SaaS product consultant for small retailers in the Dominican Republic. Review an existing plan and propose a better one if you find it. Do not write code. Be concrete: numbers, timelines, risks and reasons.

**The product.** Nexora POS is a Spanish-language invoicing, cash-register and inventory system for small shops (a real supplements, shapewear and makeup store with several cashiers uses it today). Stack: React + TypeScript + Vite (installable PWA), NestJS + Prisma API, PostgreSQL 17 on Render, Tauri desktop app for Windows, offline sales queue in IndexedDB. Features: sales; cash sessions with open, close and reconciliation with manager PIN; voids with approval; returns; store credit and cash-on-delivery; bank transfers with verification; courier fees; seller incentives; 40 reports; Excel product import and AI reading of supplier invoices; stock entries, exits and transfers between warehouses; encrypted backups. Code on GitHub (`marcosfeliz28/awesome-outbid`; branch `nexora-cloud` is the live store, `producto-nexora` is the product).

**Already done for selling it.** Multi-tenancy: every table has `tenantId`, double lock (filter in code + PostgreSQL Row-Level Security) and an automated test matrix showing 0 cross-tenant leaks across 152 routes.

**Current plan (summary).**

- Phase 1: public sign-up, 14-day free trial, plan states (trial → active → past due with 7-day grace → read-only; data is never deleted), billing behind an interface with a test provider, per-plan limits, per-tenant export and backup.
- Phase 2: "Ask Nexora" assistant. The server gives the model **read-only** tools that are the API's own GET routes, called with the asking user's token, so the AI inherits exactly that user's permissions, branch and tenant. The AI never moves money, stock or prices: it explains the steps. Its only action is to **request** a void, which the user confirms and a manager approves. Monthly quota per plan and an audit log of every query. Low-cost model by default. A read-only `support` role that the customer enables for 24 h or 7 days so the owner can give support without being able to change anything; every support query is visible to the customer.
- Phase 3: signed Windows installer, auto-update, license with offline mode, guided first run.
- Phase 4: DGII fiscal receipts (NCF and e-CF), legal documents, sales page, real billing and a pilot.
- Phase 5: full offline with sync, and phone apps.
- Proposed plans (DOP/month): Self-service 990 (1 branch, 1 register, 2 users, 30 AI queries), Basic 1,990 (50 queries), Pro 3,990 (300 queries, priority support), Premium 7,990 (1,000 queries). Two months free on annual billing.

**What we ask for (deliver in this order):**

1. **Plan critique:** what is missing, what is unnecessary, and what order you would change to sell sooner without risking data or money. Up to 10 points, most important first.
2. **Support AI:** is it safe and sufficient for the AI to use GET routes with the user's token? What attacks do you see (prompt injection from data such as customer names or notes, cross-tenant leaks, quota abuse)? Which everyday shop questions do those tools not cover? Propose the final tool list.
3. **Owner support without write access:** assess the read-only role with temporary access and a customer-visible log. How would you do it? How should that support be priced?
4. **Prices and costs:** estimate the monthly cost per customer (server + AI per query + card processing) and the minimum price per plan to avoid losing money. Compare payment processors that work for a Dominican business with recurring subscriptions (Azul, CardNET, PayPal, Stripe via another entity, or others), with fees and requirements. Cite the source and date of every price; if you cannot confirm it, say so.
5. **Installer and license:** how you would sell the laptop version: Windows code signing, updates, offline license, what happens when the customer stops paying, local versus cloud database.
6. **Tax and legal in the Dominican Republic:** what the DGII currently requires for electronic invoicing (e-CF) from software sold to third parties, and which legal documents the product needs.
7. **Your phase plan** with a measurable done criterion per phase and an effort estimate (S/M/L).

**Rules:** do not claim something exists in the code unless you verified it; say when you did not. Do not ask for passwords or real store data. **Answer in Spanish.** Format: short headings and tables.
