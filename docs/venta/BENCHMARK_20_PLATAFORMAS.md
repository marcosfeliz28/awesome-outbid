# Benchmark de 20 plataformas de facturación / POS

> Elaborado para Nexora POS · DeepSeek (D46) · Fecha de consulta de precios:
> **2026-10-27**.
>
> Metodología: investigación web con fuentes. **Solo hechos respaldados por URL.**
> Todo lo no verificado se marca **«NO CONFIRMADO»**. Los precios llevan su URL y
> fecha de consulta. Las afirmaciones sobre Nexora POS que no estén verificadas
> se marcan como **supuesto** y las rutas del repo se citan tal como existen hoy
> (`apps/api/src`, `apps/web/src`, `packages/shared`).

---

## (a) Tabla comparativa de las 20

| # | Plataforma | País | Precio de entrada | POS/caja | Fact. electrónica | Inventario | Offline | IA |
|---|---|---|---|---|---|---|---|---|
| 1 | Alegra | CO/LatAm | COP 17.900/mes | Sí | DIAN + e-CF/CFDI multi-país | Sí | Sí | Sí (Alegra IA) |
| 2 | Siigo | CO/LatAm | Gratis (5 docs/año) | Sí | DIAN | Sí | NO CONFIRMADO | Sí (agentes IA) |
| 3 | Odoo | Global | Gratis (1 app) | Sí | e-CF RD (l10n_do 19.3, SaaS) | Sí | Sí | Sí (IA agéntica) |
| 4 | Square | US/global | $0 + tarifa 2.6%+15¢ | Sí | No (sin NCF/CFDI) | Sí | Sí (pagos) | Sí (Managerbot) |
| 5 | Lightspeed | CA/global | US$89/mes | Sí (iPad) | Peppol B2B (sin NCF/CFDI) | Sí (profundo) | Sí | Sí (Lightspeed AI) |
| 6 | Shopify POS | Global | POS Lite incluido | Sí | No nativa (apps 3ros) | Sí | Sí | Sidekick (ecomm) |
| 7 | Zoho Books | Global | Gratis | No nativo | CFDI 4.0 MX (sin NCF) | Sí | NO CONFIRMADO | Sí (Zia) |
| 8 | QuickBooks | US/global | US$38/mes | No (POS discontinuado) | No nativa (conectores) | Sí | No | Sí (Intuit Assist) |
| 9 | Loyverse | Global | Gratis | Sí | No nativa | Sí | Sí | NO CONFIRMADO |
| 10 | Treinta | CO/LatAm | COP 39.900/mes | Sí | DIAN (solo Pro) | Sí | NO CONFIRMADO | NO CONFIRMADO |
| 11 | Contífico | EC | Gratis (24 docs/año) | Sí | SRI | Sí (planes altos) | Sí | NO CONFIRMADO |
| 12 | Defontana | CL/LatAm | Gratis (Emprendedor) | Sí | SII/SAT/SUNAT/DIAN | Sí | NO CONFIRMADO | Sí (Defontana IA) |
| 13 | Bind ERP | MX | MXN 399/mes (3ros) | NO CONFIRMADO | CFDI 4.0 | Sí | NO CONFIRMADO | NO CONFIRMADO |
| 14 | Facturama | MX | MXN 165/año (40 folios) | No | CFDI 4.0 + API | No (catálogos) | NO CONFIRMADO | NO CONFIRMADO |
| 15 | Holded | ES | €15/mes | Sí (TPV gema €25) | Verifactu/SII/TicketBAI | Sí (gema) | NO CONFIRMADO | Sí (OCR/conciliación) |
| 16 | Quipu | ES | €8,5/mes | No | Verifactu | No | NO CONFIRMADO | Sí (Genius AI) |
| 17 | Sage | Global | US$117,75/mes | No central | VERI*FACTU/SII (add-on) | Sí (Premium) | NO CONFIRMADO | Sí (Copilot) |
| 18 | Nubox | CL | 1,05 UF/mes | NO CONFIRMADO | DTE (Chile; **no existe "Nubox RD"**) | NO CONFIRMADO | NO CONFIRMADO | NO CONFIRMADO |
| 19 | Vend / Lightspeed X | Global | NO CONFIRMADO | Sí | NO CONFIRMADO | Sí | Sí | NO CONFIRMADO |
| 20 | Cuenta Contable | RD | NO CONFIRMADO | NO CONFIRMADO | NCF/e-CF (RD) — NO CONFIRMADO | NO CONFIRMADO | NO CONFIRMADO | NO CONFIRMADO |

> Nota sobre los sustitutos dominicanos: la orden pedía sustituir plataformas que
> no aplican (Toast, Clover — solo EE. UU.) por competidores dominicanos. La
> búsqueda **no halló** un producto «Nubox RD» (Nubox es chileno) ni pudo
> verificar «Cuenta Contable» como producto público con precios. Se dejan en la
> tabla marcados **NO CONFIRMADO**; competidores RD verificables para completar
> la fila 20: **TuFacturaRD** y **CloudYa RD** (ambos ofrecen e-CF/NCF ante la
> DGII). Ver detalle en las fichas.

---

## Fichas (resumen por plataforma)

### 1. Alegra — CO/LatAm
Público: pymes y contadores. Precios: Facturación Electrónica desde COP 17.900/mes
(Emprendedor, hasta COP 10M/mes) y POS desde COP 25.900/mes
([URL](https://www.alegra.com/colombia/facturacion-electronica/precios/), 2026-10-27).
Facturación DIAN nativa y formatos locales multi-país (CFDI, e-CF, AFIP, SUNAT,
SRI). POS con cierre de turnos y bodegas. Inventario por referencia/variante.
IA «Alegra IA». Offline sí. **Hace bien:** cumplimiento fiscal nativo. **Le
falta:** reportes poco personalizables (terceros).

### 2. Siigo — CO/LatAm
Público: pymes y comercios. Gratis (5 docs/año); FE 24 desde COP 9.992/mes; POS
Esencial COP 28.750/mes
([URL](https://www.siigo.com/precios-siigo/), 2026-10-27). Facturación DIAN;
agentes IA (Actualícese, Causación DIAN). POS con precuentas/turnos. Offline NO
CONFIRMADO. **Hace bien:** FE sencilla + contabilidad preconfigurada. **Le
falta:** límites por nº de documentos que fuerzan a subir de plan.

### 3. Odoo — Global (BE)
Público: pymes a empresas. Gratis (1 app); Estándar US$8,95/usuario/mes;
Personalizado US$16,40
([URL](https://www.odoo.com/es_ES/pricing), 2026-10-27). **e-CF dominicano** vía
localización oficial `l10n_do` + módulo `l10n_do_edi` (documentos E31–E34, firma
digital con Infile), **solo Odoo Online 19.3+**
([fuente](https://raw.githubusercontent.com/odoo/documentation/master/content/applications/finance/fiscal_localizations/dominican_republic.rst)).
POS con offline. IA agéntica. **Hace bien:** ERP integrado a precio por usuario.
**Le falta:** e-CF RD requiere cuenta Infile aparte y solo SaaS.

### 4. Square — US/global
Público: pymes retail/servicios. $0/mes + tarifa 2.6% + 15¢ presencial
([URL](https://squareup.com/us/en/pricing), 2026-10-27). POS gratis iOS/Android.
Sin NCF/CFDI (NO CONFIRMADO soporte LatAm). Inventario, multi-ubicación. IA
Managerbot. Offline de pagos sí. **Hace bien:** cobro transparente, hardware
barato. **Le falta:** facturación fiscal LatAm.

### 5. Lightspeed — CA/global
Público: retail/restaurantes con muchas SKU. Retail Basic US$89/mes
([URL](https://www.lightspeedhq.com/pos/retail/pricing/), 2026-10-27). POS iPad.
Facturación B2B vía Peppol (Bélgica); **NCF/CFDI NO CONFIRMADO**. Inventario
profundo, multi-tienda. IA Lightspeed AI. Offline sí. **Hace bien:** inventario y
analítica. **Le falta:** sin Android, caro para tienda única, sin NCF/CFDI.

### 6. Shopify POS — Global
Público: retailers omnicanal. POS Lite incluido con plan Shopify; POS Pro
US$89/ubicación/mes
([URL](https://www.shopify.com/pos/pricing), 2026-10-27). Facturación fiscal no
nativa (CFDI vía apps de terceros). Inventario multi-ubicación, 1000+ ubicaciones.
IA Sidekick (ecomm). Offline sí. **Hace bien:** omnicanal online+tienda. **Le
falta:** NCF/e-CF nativos, impuestos nativos solo EE. UU.

### 7. Zoho Books — Global
Público: pymes/autónomos/contadores. Gratis (1000 facturas/año); Standard
US$20/mes
([URL](https://www.zoho.com/books/pricing/), 2026-10-27). CFDI 4.0 MX; **NCF NO
CONFIRMADO**. Sin POS nativo. Inventario desde Professional. IA Zia (chat,
CoCreate). **Hace bien:** plan gratis, IA, ecosistema. **Le falta:** POS, NCF RD,
offline.

### 8. QuickBooks — US/global
Público: pymes/contadores. Simple Start US$38/mes
([URL](https://quickbooks.intuit.com/pricing/), 2026-10-27). Facturación
electrónica no nativa (conectores Avalara/Pagero/Sovos). POS Desktop
**discontinuado**. Inventario en Plus/Advanced. IA Intuit Assist. Sin offline.
**Hace bien:** contabilidad madura, conciliación bancaria. **Le falta:** POS,
NCF/CFDI nativos, multi-empresa, offline.

### 9. Loyverse — Global
Público: pequeños negocios. **Gratis**; add-ons: historial US$7/mes, inventario
avanzado US$25/mes
([URL](https://loyverse.com/pricing), 2026-10-27). POS móvil gratis (iOS/Android).
Facturación fiscal no nativa (NO CONFIRMADO). Inventario esencial gratis. Offline
sí. **Hace bien:** POS gratis completo, multi-tienda. **Le falta:** facturación
fiscal, IA.

### 10. Treinta — CO/LatAm
Público: micro/pequeños negocios. Esencial COP 39.900/mes; Pro COP 79.900/mes
([URL](https://treinta.co/planes-y-precios), 2026-10-27). POS desde celular.
Facturación DIAN solo en Pro. Inventario en tiempo real. Sin multi-sucursal (1
suscripción = 1 negocio). Offline NO CONFIRMADO. **Hace bien:** sencillez para
tenderos. **Le falta:** multi-sucursal, IA, offline.

### 11. Contífico (Siigo Contífico) — EC
Público: pymes/contadores EC. Gratis (24 docs/año); FE 48 US$14,35/año; POS
US$292,80/año
([URL](https://www.siigo.com/ec/planes/), 2026-10-27). Facturación SRI. POS con
sincronización nube y modo sin conexión. Inventario en planes contables.
**Hace bien:** SRI madura y económica. **Le falta:** FE pura limitada a 2
usuarios; multi-sucursal NO CONFIRMADO.

### 12. Defontana — CL/LatAm
Público: pymes LatAm. Emprendedor gratis; POS 1,5 UF/mes
([URL](https://digital.defontana.com/pos), 2026-10-27). Facturación SII/SAT/SUNAT/
DIAN nativa. POS con locales/bodegas ilimitadas. IA Defontana IA/agentes.
Offline NO CONFIRMADO. **Hace bien:** cumplimiento fiscal multi-país, multi-sucursal.
**Le falta:** offline, manufactura.

### 13. Bind ERP — MX
Público: pymes mexicanas. Básico MXN 399/mes (fuente terceros)
([URL](https://www.bind.com.mx/SistemaDeAdministracion/Precios), 2026-10-27). CFDI
4.0 timbrado ilimitado. Inventario multi-almacén. POS NO CONFIRMADO. **Hace
bien:** CFDI + inventario + cartera. **Le falta:** solo México, sin POS/nómina
nativos.

### 14. Facturama — MX
Público: pymes/desarrolladores MX. 40 folios MXN 165/año; ilimitado MXN 1650/año
([URL](https://facturama.mx/planes-facturacion), 2026-10-27). CFDI 4.0 + API REST
(SDK multi-lenguaje). **No es POS** ni inventario. **Hace bien:** API y folios
claros. **Le falta:** POS, inventario, IA.

### 15. Holded — ES
Público: pymes/autónomos ES. Plus €15/mes; Estándar €59/mes
([URL](https://www.holded.com/es/precios), 2026-10-27). Verifactu/SII/TicketBAI.
TPV e Inventario como «gemas» aparte (€25). IA fuerte (OCR, conciliación). **Hace
bien:** todo-en-uno + IA + integraciones. **Le falta:** TPV/inventario como
extra, sin NCF/CFDI.

### 16. Quipu — ES
Público: autónomos/pymes ES. Starter €8,5/mes; Solution €15/mes
([URL](https://getquipu.com/es/plan-de-precios), 2026-10-27). Verifactu. **No
POS** ni inventario. IA Genius AI. **Hace bien:** facturación/tesorería con IA.
**Le falta:** POS, inventario, multi-sucursal.

### 17. Sage — Global
Público: pymes/medianas. Sage 50 Pro US$117,75/mes
([URL](https://www.sage.com/en-us/products/sage-50/pricing/), 2026-10-27).
VERI*FACTU/SII (add-on ES); CFDI vía localización de terceros. Inventario en
Premium+. IA Sage Copilot. POS no central. **Hace bien:** contabilidad sólida +
IA. **Le falta:** transparencia de precios, POS, NCF/CFDI core.

### 18. Nubox — CL (no «Nubox RD»)
Público: pymes/contadores chilenos. En Marcha 50 DTE: 1,05 UF/mes
([URL](https://odoo.nubox.com/shop/sfact64-en-marcha-plan-50-dte-2490), 2026-10-27).
Facturación DTE (Chile). **No hay producto para República Dominicana** (NCF/e-CF
NO CONFIRMADO; no existe). Se incluye para documentar que el sustituto sugerido
no aplica.

### 19. Vend / Lightspeed X — Global
Público: retail. Vend fue **adquirido por Lightspeed (2021, US$350M)** y su línea
continúa como Lightspeed X
([fuente](https://shelfperks.com/resources/blogs/vend-pos-lightspeed-acquisition)).
POS retail en la nube con inventario y fidelización. **Precios públicos NO
CONFIRMADO** (ahora bajo Lightspeed, cotización). NCF/CFDI NO CONFIRMADO. Offline sí.

### 20. Cuenta Contable — RD
Público: negocios RD. **NO CONFIRMADO** como producto público verificable con
precios. La orden lo sugería como competidor dominicano; no se halló ficha de
precios ni documentación oficial. Competidores RD **verificables** para esta
casilla: **TuFacturaRD** y **CloudYa RD** (e-CF/NCF ante la DGII;
[TuFacturaRD](https://tufacturard.com/software/pymes/),
[CloudYa](https://programascontabilidad.com/analisis-de-herramientas/cloudya-sistema-contable/)).
Se recomienda que la dueña confirme cuál competidor dominicano real usar aquí.

---

## (b) Matriz de funciones frente a Nexora POS

Leyenda: **S** = soportado/verificado · **NC** = no confirmado · **No** = no
soportado (o ausente). Para Nexora, las funciones no verificadas en este repo se
marcan **S\*** (supuesto declarado) o **NC**.

| Función | Nexora POS | Alegra | Siigo | Odoo | Square | Lightspeed | Shopify POS | Zoho | QB | Loyverse | Treinta | Contífico | Defontana | Bind | Facturama | Holded | Quipu | Sage | Nubox | Vend |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Facturación NCF/e-CF (RD) | **S** | S (e-CF) | No | S (19.3+) | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No | NC |
| Otro fiscal local | — | DIAN/CFDI | DIAN | CFDI/SII… | No | Peppol | No | CFDI | No | No | DIAN | SRI | SII/SAT | CFDI | CFDI | Verifactu | Verifactu | VERI*FACTU | DTE | NC |
| POS / caja | S | S | S | S | S | S | S | No | No | S | S | S | S | NC | No | S | No | No | NC | S |
| Caja ciega / cierre | S | S | S | NC | NC | NC | NC | NC | NC | S | S | NC | S | NC | No | S | No | NC | NC | NC |
| Inventario | S | S | S | S | S | S | S | S | S | S | S | S | S | S | No | S | No | S | NC | S |
| Multi-sucursal | S | S | S | S | S | S | S | S | S\* | S | No | NC | S | S | NC | NC | No | S\* | NC | NC |
| IA / automatización | S\* | S | S | S | S | S | S | S | S | NC | NC | NC | S | NC | NC | S | S | S | NC | NC |
| Offline | S | S | NC | S | S | S | S | NC | No | S | NC | S | NC | NC | NC | NC | NC | NC | NC | S |
| Integraciones | S\* | S | S | S | S | S | S | S | S | S | NC | S | S | S | S | S | S | S | NC | NC |
| Plan gratuito | No | No | S | S | S | No | No | S | No | S | No | S | S | No | No | No | No | No | No | NC |

**Notas sobre Nexora POS (supuestos declarados):**

- **Facturación NCF/e-CF**: `apps/api/src` emite NCF (B01/B02/B14/B15; **B04
  pausado**) y E31/E32; recibo no fiscal en `apps/api/src/receipt-pdf.ts`; reportes
  DGII 606/607/608 en `apps/api/src/reportes/`. **S** (verificado en el repo).
- **IA / automatización**: `apps/web/src/Assistant.tsx`, `QuickQuestions.tsx` y
  `apps/api/src/cashier-survey.ts` existen; el alcance exacto (¿OCR? ¿conciliación
  bancaria?) es **S\*** — supuesto, no verificado en detalle.
- **Integraciones**: verificadas `apps/api/src/drive-backup.ts` (Google Drive) y
  `notifications.ts` (Telegram). Otras (pasarelas de pago, ecommerce) **S\***.
- La fila «Nexora POS» ya **no** marca como S funciones no verificadas: las dudosas
  son **S\*** o **NC** (corrección 1 de PEDIDOS_DEEPSEEK.md).

---

## (c) Lo mejor de cada una — 15 patrones a copiar o superar

1. **Alegra** — cumplimiento fiscal nativo multi-país sin módulos extra; validación
   automática de pagos por transferencia (detecta notificación bancaria).
2. **Siigo** — facturación electrónica con plan gratuito de entrada y escalado por
   volumen de documentos (bajo costo para empezar).
3. **Odoo** — localización fiscal dominicana **oficial** (`l10n_do`) con e-CF
   integrado; una sola suite ERP a precio por usuario.
4. **Square** — cobro con tarifa plana transparente + hardware económico; POS
   gratis sin contrato.
5. **Lightspeed** — inventario profundo (costos landed, serializados, transferencias)
   y analítica/forecasting.
6. **Shopify POS** — omnicanal real: un solo back office para tienda física + online.
7. **Zoho Books** — IA Zia conversacional (crear facturas por prompt, detección de
   anomalías).
8. **QuickBooks** — conciliación bancaria automática y ecosistema de contadores.
9. **Loyverse** — POS móvil **gratuito** con add-ons por tienda/empleado de bajo
   costo; pantalla de cocina/cliente.
10. **Treinta** — onboarding «sin capacitación» para tenderos; registro de ventas,
    gastos, inventario y fiados en segundos desde el celular.
11. **Contífico** — facturación electrónica con plan gratuito y modo **sin conexión**
    en el POS.
12. **Defontana** — multi-sucursal con locales/bodegas ilimitadas + IA agéntica de
    atención.
13. **Facturama** — API REST de facturación con SDK multi-lenguaje y folios
    prepagados claros (para desarrolladores).
14. **Holded** — automatización IA profunda (OCR de facturas, conciliación, detección
    de duplicados) + gran catálogo de integraciones.
15. **Sage Copilot** — asistente IA de contabilidad integrado como producto, no como
    add-on.

---

## (d) Huecos de Nexora frente a los competidores

Cada punto marca su base: **[repo]** = observado en el código el 28-oct; **[opinión]**
= criterio de producto no verificable; **[fuente]** = cita externa.

1. **Sin integración nativa de e-commerce** (Shopify/WooCommerce) — **[repo]** no
   se halla código de ecommerce en `apps/api/src`; **[opinión]** es una brecha frente
   a Shopify POS/Alegra/Holded.
2. **Sin pasarela de pago integrada** (Stripe/PayPal/Azul/CardNet) — **[opinión]**;
   la orden D13 pide analizarlas, lo que sugiere que aún no hay ninguna integrada.
3. **IA limitada a asistente/preguntas rápidas**, sin OCR de facturas ni conciliación
   bancaria automática (Holded/Zoho/Sage lo tienen) — **[repo]** `Assistant.tsx` y
   `QuickQuestions.tsx` existen; **[opinión]** su alcance parece menor que Zia/Copilot.
4. **Facturación fiscal de otros países** (CFDI/DIAN/SII) no es objetivo (solo RD) —
   **[repo]** NCF/e-CF dominicano; **[opinión]** no es hueco si el foco es RD.
5. **Sin plan gratuito** para captar micro-negocios (Loyverse/Treinta/Siigo/Contífico
   sí lo tienen) — **[opinión]** de posicionamiento de venta.
6. **Transparencia de precios propia** no publicada — **[opinión]**; la propuesta de
   precios de este documento busca cerrarlo.
7. **Analítica/forecasting avanzado** (Lightspeed Insights, Zoho Analytics) — **[opinión]**;
   Nexora tiene reportes (`apps/api/src/reportes/`) pero no forecasting confirmado.

---

## (e) Propuesta final a Nexora 1

### 10 mejoras priorizadas

| # | Mejora | Impacto | Esfuerzo (h) | Riesgo | Archivos probables |
|---|---|---|---|---|---|
| 1 | Tablero «Hoy» con 4 KPIs (D47) | Alto | 6 | Bajo | `apps/web/src/Dashboard.tsx`, `Dashboard.css` |
| 2 | Integración de pago (Azul/CardNet, DOP) | Alto | 40+ | Alto | `apps/api/src/payments/*`, `apps/web/src` |
| 3 | Validación cédula/RNC con DV (D22) | Medio | 2 | Bajo | `packages/shared/src/validators/cedula-rnc.ts` |
| 4 | Utilidades de formato unificadas (D21) | Medio | 3 | Bajo | `packages/shared/src/format/` |
| 5 | Página pública de venta (D31–D34) | Alto | 12 | Bajo | `apps/landing/` |
| 6 | OCR de facturas de compra (como Holded) | Medio | 30+ | Medio | `apps/api/src/invoice.ts`, nuevo módulo OCR |
| 7 | Integración e-commerce (Shopify/Woo) | Medio | 30+ | Medio | `apps/api/src/ecommerce/*` |
| 8 | Plan gratuito de entrada (nº limitado de docs) | Alto | 8 | Bajo | `apps/api/src/billing`, `packages/shared/src/plans` |
| 9 | Conciliación bancaria automática | Medio | 30+ | Alto | `apps/api/src/reports`, nuevo módulo |
| 10 | Forecasting/analítica avanzada | Bajo | 20+ | Medio | `apps/api/src/reportes/`, `apps/web/src` |

### Propuesta de precios (sostenida en la tabla)

> **PROPUESTA** — la dueña decide. Referencias de la tabla (2026-10-27): pymes RD
> comparables pagan desde ~COP 25.900/mes (Alegra POS, ≈RD$ 350) hasta US$89/mes
> (Lightspeed). Los competidores dominicanos (TuFacturaRD/CloudYa) no publicaron
> precios verificables.

| Plan | Precio sugerido (DOP/mes) | Incluye | Límite de consultas IA/mes |
|---|---|---|---|
| Prueba | 0 (14 días) | Todo el producto, 1 sucursal, 2 usuarios | 50 |
| Básico | RD$ 1,500 | POS + caja + inventario + 1 sucursal, 3 usuarios | 200 |
| Profesional | RD$ 3,500 | + multi-sucursal, reportes DGII 606/607/608, 10 usuarios | 1,000 |
| Empresa | RD$ 6,500 | + API, integraciones, soporte prioritario, usuarios ilimitados | 5,000 |

> Justificación: por debajo de Lightspeed/QuickBooks (US$89/US$38), alineado con
> el costo de un POS LatAm (Alegra/Siigo) pero en pesos dominicanos, y con margen
> para soporte local en RD. **Todos los precios son PROPUESTA** y deben validarse
> contra el costo de soporte y la disposición a pagar real de los pilotos.

---

## Fuentes principales (fecha de consulta 2026-10-27)

- Alegra: https://www.alegra.com/colombia/facturacion-electronica/precios/ · https://www.alegra.com/colombia/pos/precios/
- Siigo: https://www.siigo.com/precios-siigo/ · https://www.siigo.com/sistema-pos/
- Odoo: https://www.odoo.com/es_ES/pricing · https://github.com/odoo/documentation (localización dominicana)
- Square: https://squareup.com/us/en/pricing
- Lightspeed: https://www.lightspeedhq.com/pos/retail/pricing/
- Shopify POS: https://www.shopify.com/pos/pricing
- Zoho Books: https://www.zoho.com/books/pricing/
- QuickBooks: https://quickbooks.intuit.com/pricing/
- Loyverse: https://loyverse.com/pricing
- Treinta: https://treinta.co/planes-y-precios
- Contífico: https://www.siigo.com/ec/planes/
- Defontana: https://digital.defontana.com/pos
- Bind ERP: https://www.bind.com.mx/SistemaDeAdministracion/Precios
- Facturama: https://facturama.mx/planes-facturacion
- Holded: https://www.holded.com/es/precios
- Quipu: https://getquipu.com/es/plan-de-precios
- Sage: https://www.sage.com/en-us/products/sage-50/pricing/
- Nubox: https://odoo.nubox.com/shop/sfact64-en-marcha-plan-50-dte-2490
- Vend/Lightspeed: https://shelfperks.com/resources/blogs/vend-pos-lightspeed-acquisition
- RD: https://tufacturard.com/software/pymes/ · https://programascontabilidad.com/analisis-de-herramientas/cloudya-sistema-contable/
