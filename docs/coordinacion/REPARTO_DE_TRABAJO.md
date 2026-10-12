# Reparto de trabajo entre los cuatro asistentes (dueña, 12-oct-2026)

La dueña ordenó usar a todos a la vez. Regla común: **cada uno trabaja en su rama, deja el resultado escrito en `TABLERO_NEXORA.md` (Entregas) y NO despliega.** Solo Claude NUBE despliega en Render (API primero, luego web) y solo con los 3 jobs de CI en verde y el visto bueno de la dueña.

| Asistente | Dónde corre | Qué hace ahora | Rama |
|---|---|---|---|
| **Claude NUBE** (arquitecto/integrador) | Nube | Revisa y mezcla entregas, CI, despliegues, inventario directo en el sistema, reportes/PDF de la dueña, revisión de publicidad, auditoría final | `nexora-cloud` / `claude/*` |
| **Claude PC** | PC de la dueña | Pruebas con hardware real: impresora térmica 80/58, lector de códigos, apertura de caja de prueba; revisar el instalador de Windows; verificar que lo que dicen los PDF/recibos se vea bien impreso. Reporta fallos por escrito, no cambia código sin orden | `claude/pc-*` |
| **ChatGPT PC** | PC de la dueña (tiene PostgreSQL) | 1) Validar la 3y con PostgreSQL real (rama `claude/merge-3y`, commit 42c0e36). 2) Publicar 3t (contraseñas 6 dígitos) y 3u (recibo/crédito PDF). | `nexora-chatgpt-fase2` |
| **ChatGPT NUBE** | Nube (sin PostgreSQL) | 3v (créditos por persona/estado de cuenta), 3w (ingresos por día y forma de pago, exportable), 3x (ajustes de crédito + aviso de margen), 3z (reportes formales diario/mensual y auditoría). Publicidad por lotes (`docs/marketing/ORDEN_PUBLICIDAD.md`) | `nexora-chatgpt-nube` |

## Reglas que no cambian
- Un commit por ID de hallazgo; cada corrección con una regresión que falle antes y pase después; `pnpm check` en verde.
- Textos en español. Sin secretos ni datos de producción. Sin contraseñas fijas.
- Margen = (precio − costo)/precio, **sin restar ITBIS**. Margen mínimo de referencia 15 %.
- Los precios de oferta de publicidad **no se tocan en el sistema**: aparecen solo en la imagen; la caja aplica el descuento en la factura.
- Lo que la dueña contó o modificó ayer u hoy no se toca sin un conteo nuevo suyo.
- Quien no pueda correr algo (por ejemplo PostgreSQL en la nube) lo dice y lo pasa a quien sí pueda; no lo da por probado.

## Orden de entrada de lo que viene
1. 3y (almacén Casa): validación de ChatGPT PC → luego Claude NUBE respalda y despliega.
2. 3t y 3u (ChatGPT PC), en paralelo 3v/3w/3x/3z (ChatGPT NUBE).
3. Cada entrega se integra en una rama `claude/merge-*`, pasa CI y recién entonces se mezcla.
