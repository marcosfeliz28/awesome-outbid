# Veredicto del arquitecto sobre la propuesta de Gemini (Claude · 24-oct-2026)

Propuesta guardada sin cambios en la rama `nexora-gemini-auditoria` (`docs/PROPUESTA_CIERRE_GEMINI.md` y `docs/PROPUESTA_PRODUCTO_GEMINI.md`, commit `8756ed1`).

**Plan maestro:** sigue siendo `docs/coordinacion/PLAN-10-MEJORAS-PRODUCTO.md` (orden de la dueña: «ejecutemos todo»). Este veredicto solo dice qué de Gemini entra en ese plan. Cada punto se verificó contra el código de `nexora-cloud`.

## Cierre de caja y ticket (Bloque 1)

| Propuesta | Veredicto | Por qué |
|---|---|---|
| Destino del dinero: «efectivo recibido por la dueña», que no suma a la gaveta | **Ya existe a medias → completar** | `ownerConfirmed` ya salda sin caja y sin tocar la gaveta, pero solo un usuario con `*` (`apps/api/src/sales.ts:3637`, `:3956`, `:4026`; web `CreditAccounts.tsx:139`, `Tienda.tsx:983`). Falta que la cajera lo marque con el **PIN de gerente** (caso del 17-oct). Orden a ChatGPT PC, bloque A1. |
| Salida de caja compensatoria mientras tanto | **Aprobado (sin código)** | Regla operativa ya posible hoy. |
| Exigir datos del voucher para pagar con tarjeta | **Ya existe** | Se exige código de aprobación y últimos 4 de la tarjeta (`sales.ts:899`, `:4072`). |
| Cierre de lote del verifón y sub-total en 0 al abrir | **Aprobado (sin código)** | Regla para las cajeras; va al manual. |
| Avisos de descuadre al celular | **Ya existe; falta el aviso de uso del PIN de gerente** | Los descuadres ya se notifican (`notifications.ts:390-409`). Bloque A3. |
| No imprimir billetes y monedas en 0 | **Ya existe** | `Prints.tsx:189-190`. |
| Cobros de facturas anteriores con número y cliente | **Ya existe** | `Prints.tsx`, sección «Créditos / contraentregas» (17-oct). |
| Línea de diferencia | **Ya existe** | «12-Diferencias» (`cash.ts:391`, `:558`). |
| Resumen claro: esperado en gaveta, contado, diferencia y «recibido por la dueña» aparte | **Aprobado** | Hoy el final dice «Entregado / Dejado en caja», que confunde. Bloque A2. |
| Reporte diario sin ITBIS por línea, con el neto y el ITBIS al pie | **Ya existe** | `Prints.tsx:361-381` (17-oct). La foto que vio Gemini es de antes del arreglo. |
| Cortar el nombre del producto a 22 letras | **No** | La dueña pidió el 17-oct el nombre completo en su propio renglón. |

## Producto (Bloque 2)

| Propuesta | Veredicto | Por qué |
|---|---|---|
| Serie B (B01/B02/B04) en la fase 1 y e-CF en la fase 3 | **Rechazado** | Pequeños y microempresas deben emitir e-CF desde el **15-nov-2026**; medianos y grandes, el **1-nov**. Un cliente nuevo no puede empezar con Serie B. Se mantiene la mejora 1: e-CF con un proveedor autorizado. |
| 606/607 | **Ya en el plan** | Mejora 5 (606 + IT-1; el 607 solo hace falta si el negocio no factura 100 % electrónico). |
| Cobro por transferencia verificada desde el día 1 | **Aprobado** | Usa la verificación de transferencias que ya existe. Primer `BillingProvider` real de la fase 1, mientras Azul o CardNET aprueban. |
| Piloto de 3 a 5 tiendas en la PWA antes del instalador | **Aprobado** | La PWA ya se instala. |
| Instalador Windows (Tauri) más tarde | **Aprobado** | Pasa detrás de e-CF, fase 1 e IA. |
| Licencia Ed25519 y control del reloj | **Aprobado para cuando toque el instalador** | |
| Activación pagada o soporte humano por evento | **Decisión de la dueña** | Propuesta razonable; cifras sin verificar. |
| Límite de equipos por plan | **Ya existe la base** | Los equipos aprobados ya existen; el límite por plan va en la fase 1 (punto 4). |
| Sin internet acotado (solo facturar y encolar) | **Aprobado como principio** | Para cuando toque el modo sin internet. |
| IA: rutas GET con el usuario + RLS | **Aprobado, con correcciones** | Su punto (a) no aplica aquí: las rutas ya esconden costo y margen sin `profit:read` (`reports.ts:700-713`). Sí aplican (b) usar reportes que ya vienen sumados y (c) el manual. Orden a ChatGPT NUBE. |
| Defensas contra instrucciones escondidas en los datos, cuota, 500 caracteres, 31 días, 5 por minuto | **Aprobado** | |
| 10 herramientas cerradas | **Aprobado, mapeadas a rutas existentes** | Ver la orden de fase 2. |
| Soporte de solo lectura con `SET TRANSACTION READ ONLY` | **Aprobado como segundo cerrojo** | El primero: la guardia niega toda ruta que no sea GET al rol `support`. La bitácora del soporte se escribe aparte, fuera de la transacción de solo lectura. |
| Costos, precios y pasarelas | **Hipótesis, sin verificar** | Gemini no cita fuentes. Los precios del proveedor de e-CF ya están en la mejora 1. |
| e-CF con firma X.509 propia y QR | **A través del proveedor** | No se construye un emisor propio (mejora 1). |

## Órdenes que salen de aquí

- ChatGPT PC: `ORDEN_AJUSTES_GEMINI_CHATGPT_PC.md` (cierre de caja de la tienda + ajustes a la fase 1).
- ChatGPT NUBE: `ORDEN_FASE2_IA_SOPORTE_CHATGPT_NUBE.md`, actualizada con las 10 herramientas y las defensas.
