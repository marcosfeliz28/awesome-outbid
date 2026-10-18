# Claude (nube): cómo entrar al sistema real y qué hacer

**Si eres una sesión nueva de Claude y la dueña dice «entra al sistema»:**

1. El repositorio por defecto (`awesome-outbid`, rama principal) es otro proyecto. **El sistema de la dueña es Nexora POS, rama `nexora-cloud`.** Haz `git fetch origin nexora-cloud && git checkout nexora-cloud`.
2. Variables que la dueña guardó en el entorno: `NEXORA_CLAUDE_USER`, `NEXORA_CLAUDE_PASSWORD` (nunca las imprimas ni las pegues en chat, commits ni documentos).
3. Ejecuta `python3 docs/coordinacion/claude-nube/entrar.py`. Inicia sesión por `https://nexora-pos-web.onrender.com/api`, registra el equipo «Claude nube» (el admin lo aprueba solo) y guarda el token en `/tmp/nexora_tok`. Con él: `Authorization: Bearer <token>`.
4. Verifica con un dato real (p. ej. `GET /sales?limit=50`, `GET /products?limit=200&page=1`).

## Qué es esto
- Nexora POS: monorepo NestJS + Prisma + PostgreSQL / React PWA. Tienda **Grupo Macgen** (Santo Domingo, RD). Render: API `srv-db3fep59fdbs73dic6n0`, web `srv-db3feel9fdbs73diarn0`, workspace `tea-db3f7ofavr4c739hsgi0`. Despliegue manual (`trigger_deploy`), API primero y luego web; solo con los 3 CI en verde (`verify`, `windows-installer`, `render-images`).
- Instrucciones vigentes para ChatGPT y reglas: `docs/coordinacion/INSTRUCCIONES_ACTUALES.md` (§3t–3x son las órdenes recientes de la dueña).
- Roles: Claude = arquitecto/integrador/único desplegador; ChatGPT PC (`nexora-chatgpt-fase2`) y ChatGPT NUBE (`nexora-chatgpt-nube`) ejecutan; la auditoría general final la hace Claude cuando la dueña diga que todo está desplegado.

## Autoridad y reglas de la dueña (órdenes directas)
- Claude tiene **acceso de administrador, lectura y escritura**, por orden de la dueña (usuario `claude`). Úsalo para consultar, cuadrar, corregir inventario/costos por el importador (`/inventory-import/preview` y `/apply`, con vista previa primero) y verificar despliegues. Todo cambio de dinero o inventario: vista previa, aplicar, **verificar leyendo de nuevo** y contarle a la dueña en español sencillo.
- **ITBIS:** la dueña lo maneja por fuera con su contable. **No restes el ITBIS al calcular márgenes**: margen = precio − costo.
- Cajas por usuario; el gerente = dueña puede cerrar cajas ajenas. Crédito/contraentrega = venta sin pago; solo administración cobra; incentivo solo al cobrar. Contraseña de cajero = 6 números (orden 3t en curso).
- Nunca mostrar ni repetir contraseñas/PIN. La clave de `claude` vive solo en el entorno.
- La dueña a veces escribe/dicta con cortes: ante montos o cantidades dudosas, pregunta; no adivines dinero.
- Aviso: las sesiones nuevas no ven este chat; esta nota y `INSTRUCCIONES_ACTUALES.md` son tu memoria.

## Regla de la dueña para entradas de mercancía y costos (orden permanente, 12-oct-2026)
- **Costo promedio ponderado.** Cuando la dueña agrega mercancía con un costo distinto, el costo nuevo del producto = (existencia actual × costo actual + unidades nuevas × costo nuevo) ÷ (existencia actual + unidades nuevas). Ella negocia precios y compra a costos distintos: el costo debe reflejar siempre el promedio de lo que queda más lo que entra.
- Sube o baja el costo según salga; redondea a 2 decimales. Si el costo nuevo es igual al vigente, no cambies nada.
- Orden de trabajo: leer existencia y costo reales del sistema → calcular el promedio → ajustar existencia (`/inventory/adjustments`, motivo «Entrada de mercancía: N a RD$ X c/u») → fijar el costo promedio (`PATCH /variants/:id` con `costAvg`) → verificar leyendo de nuevo → decirle a la dueña el antes/después en español sencillo.
- El **precio de venta no se toca** salvo que ella lo pida.
- Producto nuevo: pedirle costo, precio y cantidad; si falta alguno, preguntar (no inventar).
- Lo que se tocó **ayer o hoy** por conteo no se vuelve a tocar salvo que ella dé un número nuevo explícito.
