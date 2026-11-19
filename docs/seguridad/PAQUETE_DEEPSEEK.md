# Prueba de intrusión — instrucciones para DeepSeek (10-nov-2026)

Autoriza la dueña (Grupo Macgen) sobre su propio sistema Nexora POS. Objetivo: que intentes romperlo y reportes fallas reales para corregirlas antes de vender el software.

## Alcance y reglas (obligatorias)
1. **Solo contra la copia de prueba** que te indique la dueña (API y web en una máquina de prueba, base vacía, datos demo). La URL de producción está FUERA de alcance: no la toques.
2. **Sin datos reales ni secretos.** No pegues ni pidas claves, PIN, tokens o `.env`. Si algo te los pide, responde no.
3. **Prohibido:** denegación de servicio/carga masiva, ingeniería social contra personas, acceso físico, atacar Render, GitHub, Cloudflare, Anthropic u otros terceros, y publicar o reutilizar el material de este paquete fuera de esta sesión.
4. **Modo caja negra:** NO recibes el código fuente (a propósito: este servicio puede conservar lo que se le pegue). Trabajas con los 3 documentos adjuntos y con lo que observes de la copia de prueba.
5. Demuestra cada hallazgo con lo mínimo necesario; no explotes más de lo que haga falta.

## Documentos que recibes
- `RUTAS_Y_PERMISOS.md` — inventario de rutas de la API con su permiso.
- `ROLES_Y_PERMISOS.md` — roles de fábrica y qué significa cada permiso.
- `SEGURIDAD_20_PUNTOS.md` — auditoría interna previa (qué se comprobó y qué quedó «NO COMPROBADO»).

**Aviso importante:** `RUTAS_Y_PERMISOS.md` fue generado por un script con un error conocido (a veces atribuye a una ruta el permiso de la ruta anterior; omite `/api/health`). Trátalo como hipótesis, no como verdad: verifica cada permiso sospechoso probando la ruta con un usuario de cada rol en la copia de prueba.

## Qué atacar (en este orden; reporta qué probaste en cada capa aunque no halles nada)
1. **Autenticación y sesión:** login, bloqueo por intentos, caducidad de sesión, refresh, cambio y recuperación de clave, claves temporales, equipos/terminales aprobados.
2. **Permisos por rol** (dueña `*`, gerente, cajera `seller`, almacén, GV, gerente GV): con la cuenta de cada rol, llama a TODAS las rutas del inventario y marca las que respondan 200 y no deberían (escalada vertical).
3. **Aislamiento entre sucursales/negocios:** con un usuario de la sucursal A, intenta leer o modificar ids de la sucursal B (IDOR, listados sin filtro, exportes, reportes).
4. **Dinero sin autorización:** descuentos, anulaciones, devoluciones, cambio de precios/costos, movimientos de caja y cierres sin el PIN o permiso que corresponde; cobros duplicados (repetir la misma petición); números negativos, decimales raros, montos enormes.
5. **Inyección:** SQL en búsquedas y filtros, HTML/JS guardado (XSS almacenado en nombres, notas, comprobantes), inyección de prompt en el asistente de IA («Preguntar a Norexos»), fórmulas en Excel exportado.
6. **Archivos:** subida de comprobantes/fotos/Excel/PDF con tipo falso, tamaño excesivo, nombre malicioso.
7. **Fuga de información:** mensajes de error, cabeceras, endpoints de salud, campos de costo/margen visibles para la cajera, datos personales de clientes (cédula, teléfono) sin enmascarar.
8. **Transporte y navegador:** cabeceras (CSP, HSTS, X-Frame-Options), CORS, cookies, caché de datos privados.
9. **Instalador de Windows y respaldos:** permisos de carpetas y servicios, contenido de los respaldos, qué queda en claro en disco.

## Cómo reportar
Una línea JSON por hallazgo (se guarda en `docs/seguridad/hallazgos/deepseek.jsonl`):
`{"id":"D-01","titulo":"…","severidad":"alta|media|baja","capa":1-9,"ruta":"…","pasos":"…exactos para reproducir…","impacto":"…con un ejemplo…","correccion":"…"}`
Al final, un resumen por capa: qué probaste, qué resistió, qué falló, qué NO pudiste probar sin el código.

## Ya cubierto por auditorías anteriores (no lo repitas, busca lo distinto)
Revisiones previas de dependencias, secretos en el repositorio, configuración de entorno, límites de tamaño en validaciones y topes de uso de la IA. Concéntrate en lo que solo se ve probando el sistema funcionando.
