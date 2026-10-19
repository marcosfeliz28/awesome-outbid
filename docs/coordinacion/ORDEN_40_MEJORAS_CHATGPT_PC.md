# Orden para ChatGPT PC — 40 mejoras para vender más y controlar mejor (19-oct-2026)

**Quién:** ChatGPT PC. **Qué entrega:** un documento, sin código. **Tiempo:** tómate el que haga falta; calidad antes que rapidez.

## Contexto
Nexora POS es el sistema de Grupo Macgen (tienda de suplementos, maquillaje, fajas y ropa deportiva en Santo Domingo). Lee primero `AGENTS.md`, `CLAUDE.md`, `docs/coordinacion/INSTRUCCIONES_ACTUALES.md` y `docs/operacion/PENDIENTES-DUENA.md` para saber lo que el sistema ya hace (caja con PIN de gerente, contraentregas, créditos, almacén Casa/Tienda, mensajero, alertas, reportes diarios, bitácora de mercancía). No propongas lo que ya existe; si propones mejorarlo, dilo.

## Qué hacer
1. Investiga en internet, en otros sistemas de punto de venta (Square, Shopify POS, Lightspeed, Odoo, Loyverse, Vend, Alegra, sistemas usados en República Dominicana) y en buenas prácticas de comercio minorista.
2. Reúne **40 mejoras potenciales**, repartidas en:
   - Seguridad y control interno (robos, descuentos, anulaciones, caja, permisos).
   - Estadística y reportes (qué se vende, márgenes, rotación, vendedores, horas pico).
   - Inventario (reabastecimiento, vencimientos, conteos, mermas, Casa/Tienda).
   - Ventas y caja (rapidez, ofertas, combos, ventas al por mayor/volumen).
   - Llegar al cliente (WhatsApp, fidelidad, recordatorios de recompra, redes, catálogo).
   - Precios (mejor precio sin bajar del margen mínimo de 15 %, precios por volumen, comparación con competencia).
   - Cualquier otra que ayude a vender más o perder menos.
3. Por cada mejora: nombre, qué problema resuelve en ESTA tienda, ejemplo de quién lo usa (sistema o empresa), beneficio esperado, dificultad (baja/media/alta), riesgo, y si necesita un servicio pagado o externo (con costo aproximado y fuente).
4. Ordena las 40 por impacto ÷ esfuerzo y marca las **10 primeras** para empezar.
5. Para esas 10, escribe **cómo las instalarías en Nexora**: qué pantallas, qué datos nuevos, qué reglas, qué pruebas, en qué orden y en cuántas entregas pequeñas. Sin código todavía.

## Reglas que no cambian
- Margen = (precio − costo) / precio, sin restar ITBIS; mínimo 15 %. No cambiar precios en el sistema por una oferta (la caja aplica el descuento).
- Nada de datos reales de clientes ni credenciales en el documento. No entres a producción ni a Render.
- Fuentes con enlace para cada afirmación sacada de internet.
- Español claro, para la dueña; tecnicismos solo en la parte de instalación.

## Entrega
Rama `nexora-chatgpt-pc-40mejoras`, archivo `docs/propuestas/40-MEJORAS.md`. Al terminar, resume a la dueña en 5 líneas: las 3 mejores, cuánto costarían y por cuál empezarías. Claude revisa la propuesta antes de construir nada.
