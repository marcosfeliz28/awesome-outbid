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
- Decisión de la dueña: **enviar código a servicios de terceros (OpenAI, Google, DeepSeek) es su decisión.** DeepSeek es de una empresa china y su servicio en línea puede conservar lo que se le pegue; recomendación: darle solo el paquete público y las rutas, no el código completo, o correrlo localmente si ella prefiere.

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
