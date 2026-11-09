# Prueba de intrusión con ChatGPT, Gemini y DeepSeek — plan (N1, 9-nov-2026)

Autoriza la dueña (Grupo Macgen) sobre su propio sistema Nexora POS. Objetivo: que tres IA distintas intenten romperlo y reporten fallas reales, para corregirlas antes de vender.

## Reglas de la prueba (se les pegan a las tres IA)

1. **Solo contra una copia de prueba, nunca contra la tienda en vivo.** Entorno: la API y la web levantadas en una máquina de prueba con base de datos vacía y datos demo (`pnpm` local o el instalador en una VM). La URL de producción (`nexora-pos-web.onrender.com`) está FUERA de alcance.
2. **Sin datos reales.** Nada de clientes, facturas, claves ni PIN de la tienda. Las claves de la copia de prueba son inventadas y se cambian después.
3. **Prohibido:** denegación de servicio/carga masiva, ingeniería social contra personas, acceso físico, atacar Render, GitHub, Cloudflare, Anthropic u otros terceros, y extraer o publicar el código fuera de las sesiones de prueba.
4. **Permitido:** autenticación y sesiones, permisos por rol (cajera, gerente, administración, dueña), aislamiento entre sucursales, inyección (SQL, HTML/JS, prompt de la IA de ventas), subida de archivos (comprobantes, fotos), carga de Excel/PDF, límites de intentos, manejo de errores, caja ciega, descuentos y anulaciones sin PIN, cambio de precios o costos sin permiso, exportaciones, copias de seguridad, el instalador de Windows (permisos de servicios y carpetas), cabeceras y CORS, y el asistente de IA (inyección, fuga de otro negocio).
5. **Cada hallazgo** se reporta con: título, severidad (alta/media/baja), pasos exactos para reproducirlo, qué se obtiene (impacto con un ejemplo), y cómo corregirlo. Sin explotar más de lo necesario para demostrarlo. Formato: una línea JSON por hallazgo en `docs/seguridad/hallazgos/<ia>.jsonl` (campos: id, titulo, severidad, ruta, pasos, impacto, correccion).
6. **No se pega ningún secreto en estas IA.** Si piden una clave real, la respuesta es no.

## Qué se les entrega

- El **paquete de auditoría de solo código público** (sin claves, sin datos, sin `.env`) y la lista de pantallas/rutas: `docs/auditoria/RUTAS_Y_PERMISOS.md`, `docs/sistema/ROLES_Y_PERMISOS.md`, `docs/auditoria/SEGURIDAD_20_PUNTOS.md`.
- **Para Gemini específicamente (orden de la dueña, 9-nov):** además de los 3 documentos anteriores, se le entregan dos archivos reales de código (copias en `docs/seguridad/paquete-gemini/`, revisados sin claves/secretos/credenciales reales — solo nombres de campo como `passwordHash`/`secretHash`), para que cruce los documentos contra las validaciones reales:
  - `docs/seguridad/paquete-gemini/common.ts` (copia de `apps/api/src/common.ts`): el `AuthGuard` real (verificación de JWT, sesión, bloqueo de cuentas, timeout) y los helpers de permisos (`can`, `Permit`, `Public`, `scoped`, enmascarado de PII).
  - `docs/seguridad/paquete-gemini/schema.prisma` (copia de `apps/api/prisma/schema.prisma`): el esquema completo de datos (roles, permisos, usuarios, sesiones, sucursales, relaciones).
  - Pedirle a Gemini explícitamente: señalar cualquier contradicción entre lo que dicen RUTAS_Y_PERMISOS.md/ROLES_Y_PERMISOS.md y lo que el `AuthGuard`/schema realmente exigen (permiso faltante, chequeo que no corresponde al rol, campo sin la restricción que el doc promete, aislamiento de sucursal no reforzado en el esquema).
- Decisión de la dueña: **enviar código a servicios de terceros (OpenAI, Google, DeepSeek) es su decisión.** DeepSeek es de una empresa china y su servicio en línea puede conservar lo que se le pegue; recomendación: darle solo el paquete público y las rutas, no el código completo, o correrlo localmente si ella prefiere. Para ChatGPT y DeepSeek se mantiene el paquete de solo documentos (sin los 2 archivos de código), salvo que la dueña ordene lo mismo para ellos.

## Cómo se prepara la copia de prueba (lo hacen ChatGPT PC o Claude PC en la laptop)

1. `git pull` de `nexora-cloud`; `pnpm install`; base PostgreSQL local vacía; `pnpm db:generate`, migraciones y semilla demo; arrancar API y web en `localhost`.
2. Usuarios de prueba con claves inventadas: `cajera.test`, `gerente.test`, `admin.test`, `duena.test`, más una segunda sucursal `sucursal-b` con su propio gerente (para probar aislamiento).
3. Dejar la IA de ventas apagada, salvo una prueba aparte con una clave de Anthropic de prueba y tope bajo.
4. No exponer esa copia a internet; que las IA trabajen sobre capturas, rutas y respuestas que se copian a mano, o con acceso local controlado.

## Prompt para cada IA (copiar y pegar)

> Eres un auditor de seguridad con permiso por escrito del dueño de **Nexora POS**, un punto de venta (API NestJS + Prisma/PostgreSQL, web React). Tu trabajo: encontrar fallas explotables en una COPIA DE PRUEBA con datos inventados. Reglas: no ataques servicios de terceros ni producción, no hagas denegación de servicio, no pidas ni uses secretos reales, no publiques nada. Te doy el listado de rutas y roles, el modelo de permisos y la lista de 20 controles de seguridad. Busca primero: saltarte permisos por rol, leer o cambiar datos de otra sucursal, anular facturas o dar descuentos sin PIN de gerencia, ver costos y utilidades siendo cajera, fuerza bruta de login o PIN, robo de sesión, XSS e inyección, subida de archivos maliciosos, filtración de datos en errores, y engaño al asistente de IA para que revele datos ajenos. Para cada hallazgo entrega: título, severidad, pasos exactos, impacto con ejemplo y corrección sugerida, en líneas JSON. Si no encuentras nada en un área, dilo y explica qué probaste.

## Después de la prueba (lo hace N1)

1. Reunir los tres `.jsonl`, quitar duplicados y falsos positivos (reproducir cada uno en la copia local).
2. Clasificar: alta = corregir antes de vender; media = esta semana; baja = lista.
3. Cada corrección en rama `claude-pc/seg-<id>` con prueba que falle antes y pase después, auditoría independiente y los 3 CI verdes. Las de dinero o permisos se confirman con la dueña antes de desplegar.
4. Informe final corto para la dueña con lo hallado, lo corregido y lo pendiente.

## Pendiente de decisión de la dueña

- ¿Qué código se comparte con cada IA (paquete público solamente, o más)?
- ¿Quién prepara la copia de prueba (ChatGPT PC o Claude PC)?

## Indicación reforzada para Gemini (9-nov, orden de la dueña: "que trate de hackearlo por todos los lados")

Mismas reglas de alcance de arriba (solo copia de prueba, sin datos reales, sin terceros, sin denegación de servicio, sin secretos reales). Este prompt es más agresivo que el genérico: pide a Gemini que ataque cada capa por separado y que agote cada una antes de pasar a la siguiente, en vez de probar superficialmente todo junto.

> Eres un atacante autorizado por escrito por el dueño de **Nexora POS** (punto de venta: API NestJS + Prisma/PostgreSQL, web React, instalador de Windows). Tienes permiso para intentar comprometerlo COMPLETO, por todas las capas, contra una COPIA DE PRUEBA con datos inventados (nunca contra producción ni contra terceros). Objetivo: que falles intentándolo todo, no que pases de largo. Trabaja capa por capa y agota cada una antes de pasar a la siguiente:
>
> 1. **Autenticación y sesión**: fuerza bruta de login y PIN (¿hay límite real de intentos y se aplica por cuenta Y por IP?), robo o fijación de sesión, token que sigue válido tras cerrar sesión o cambiar la clave, reutilización de token entre sucursales, JWT con alg none o firma débil, escalar de cajera a gerente o dueña cambiando el rol en la petición.
> 2. **Aislamiento entre sucursales**: con sesión de `sucursal-b`, intenta leer, anular o modificar algo de la sucursal principal cambiando solo un id en la URL o el cuerpo de la petición (IDOR). Igual con reportes, caja, clientes e inventario.
> 3. **Dinero sin PIN**: anular facturas, dar descuentos, cambiar precio o costo, abrir caja ya cerrada, registrar venta sin existencia o con precio negativo, todo intentando saltarte el PIN de gerencia o repetirlo (replay) desde una petición capturada.
> 4. **Inyección**: SQL en cada parámetro de búsqueda y filtro, HTML/JS almacenado (nombre de producto, nota de venta, comentario) que se ejecute al verlo otro usuario, inyección de comandos en cualquier ruta que toque archivos o procesos del sistema.
> 5. **Archivos**: sube un comprobante o foto que en realidad sea un script o un archivo con nombre/ruta manipulada (`../../`); sube un Excel/PDF corrupto o con fórmulas maliciosas a cualquier importador.
> 6. **Errores y fugas**: fuerza errores (datos raros, tipos equivocados, payloads enormes) y revisa si el mensaje devuelve rutas internas, consultas SQL, claves de configuración o datos de otro negocio.
> 7. **Asistente de IA**: intenta que revele el PIN o los datos de otra sucursal o de otro negocio, que ignore sus instrucciones (inyección de prompt) vía un mensaje de un cliente, el nombre de un producto o un archivo subido, que ejecute una herramienta que no le corresponde a su rol, o que extraiga el system prompt completo.
> 8. **Instalador y Windows**: revisa permisos de carpetas y del servicio que instala, si guarda claves en texto plano, si el respaldo o su restauración permiten sobrescribir algo fuera de su carpeta, si el actualizador verifica la firma del instalador antes de aplicarlo.
> 9. **Cabeceras, CORS y transporte**: CORS demasiado abierto, cabeceras de seguridad ausentes, cookies sin `Secure`/`HttpOnly`, HTTP en vez de HTTPS en algún punto.
>
> Para cada capa que pruebes, aunque no encuentres nada, dilo y di exactamente qué intentaste (para que sepamos que la cubriste y no la saltaste). Cada hallazgo real: título, severidad (alta/media/baja), pasos exactos para reproducirlo en la copia de prueba, qué se obtiene (impacto con un ejemplo concreto, nunca con datos reales), y cómo corregirlo. No expliques cómo causar daño más allá de lo necesario para probarlo, y no publiques nada de esto fuera de esta sesión. Entrega todo en líneas JSON, una por hallazgo (campos: id, titulo, severidad, capa, pasos, impacto, correccion), y al final un resumen de qué capas cubriste completas y en cuáles te faltó tiempo o acceso.

### Para después (N1): cómo trabajarlo a futuro
- Por cada hallazgo real y reproducible: prueba que falla antes de corregir y pasa después, en la misma regla que ya seguimos para todo el código.
- Agrupar los hallazgos por capa (la lista de arriba) en `docs/seguridad/MATRIZ_CAPAS.md` después de la prueba, para ver qué capa quedó más débil y repetir la prueba en esa capa con más profundidad la próxima vez.
- Lo que Gemini no llegó a cubrir por tiempo, pasarlo a ChatGPT o DeepSeek en la misma ronda, no dejarlo sin probar.
