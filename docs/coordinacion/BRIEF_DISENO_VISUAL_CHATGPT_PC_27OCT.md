# Brief de diseño visual para ChatGPT PC (27-oct-2026)

Orden de la dueña: elevar toda la parte gráfica de **Nexora POS** (producto SaaS) y la **aplicación/tienda** a un nivel más profesional. Hoy se ve «muy sencilla para lo que se gasta». Diseño lo haces TÚ, con tus plugins (Canva, Runway, etc.); Claude nube no tiene esas herramientas y no diseña. Claude nube solo revisa (funciones, CI, accesibilidad) y despliega.

## 1. Lo que ya existe (punto de partida; no lo rehagas, extiéndelo)
- **Estilo oficial:** «Obsidian Lumina V2» = portada que la dueña aprobó (maqueta `design/obsidian-lumina/portada-v2-ejecutiva/referencia-original.html` y `emblema-prisma.jpeg`, rama `claude/orden-diseno-interno`). Violeta sobre negro/obsidiana, N prismática, mucho aire.
- **Portada en el producto:** `apps/web/src/App.tsx` (componente `Login`) y `apps/web/src/styles.css`; tu rama `chatgpt-pc/lumina-motion-integracion` (`287db57e`) con la N grande, «Todo bajo control» y tres grupos Vende/Controla/Decide (3 CI en verde).
- **Movimiento:** `docs/diseno/obsidian-lumina/motion/` (README, clip 6 s MP4/WebM, `scripts/generate-nexora-motion.py`), una sola vez por carga, `prefers-reduced-motion` apaga todo.
- **Órdenes de diseño interior:** `docs/coordinacion/ORDEN_DISENO_INTERNO_26OCT.md` y `docs/diseno/OBSIDIAN_LUMINA_PROGRESO.md`.
- **Tokens actuales:** `apps/web/src/styles.css` línea ~59 (`:root`: `--bg`, `--surface`, `--surface-soft`, ...) y ~88 (`:root[data-theme="dark"]`). Tema claro/oscuro por `data-theme`. Hay CSS por módulo (`gv.css`, `incentives.css`, `driveBackup.css`, `inventoryImport.css`).
- **Capturas «después»** de las vistas interiores B en las ramas `chatgpt-nube/lumina-adentro-*` (PR #11–#16, aún sin mezclar).

## 2. Qué entregar (en este orden, un commit por pieza)
1. **Sistema de diseño de una página** `docs/diseno/SISTEMA_VISUAL_NEXORA.md`: paleta (con contrastes 4.5:1 medidos), tipografías (con licencia y peso; sin cargar fuentes de más de 200 KB), escala de espaciado y radios, sombras/brillos, iconografía (Lucide ya instalado), 4 estados de botón y de campo, tarjetas, tablas, gráficos, vacíos y errores.
2. **Tokens** en `styles.css` (un solo bloque `:root` + `[data-theme="dark"]`); nada de colores sueltos nuevos. Migrar por pantallas, sin cambiar clases que usan las pruebas (`.product-card`, `.cart-items`, `.connection`, `.main-content`).
3. **Pantallas por prioridad:** (a) marco/barra lateral/cabecera, (b) tablero «Hoy», (c) caja/POS clara, (d) Catálogo, Inventario, Clientes, (e) Reportes y Configuración, (f) Mercancía/Equipos, Asistente, (g) tienda `Tienda.tsx` y GV con su propia identidad (no mezclar marca de GV con el producto).
4. **Activos de marca** (Canva/Runway): logo/N prismática en SVG y WebP, favicon e icono PWA, imagen social (1200×630), 3 ilustraciones de estados vacíos, y el clip de movimiento (6 s, sin audio, sin texto dentro de la imagen). Guardar en `apps/web/public/` (livianos: <150 KB cada WebP) y los originales editables en `design/obsidian-lumina/assets/` con el enlace de Canva en un README. **Nunca** claves ni cuentas en el chat o el repo.
5. **Capturas** 1440×900, 1366×768 y 390×844, claro y oscuro, y con `prefers-reduced-motion`, en `docs/diseno/capturas/<fecha>/`.

## 3. Reglas que no se rompen
- Cajeras: versión **clara**; la administración elige claro/oscuro.
- No cambiar flujos ni teclas F2/F4/F8/F12, ni permisos, caja, pagos, NCF, API ni base de datos.
- Arqueo ciego: ninguna pantalla nueva muestra importes a la cajera con caja abierta.
- Sin cifras de marketing no medidas («+40 %», «#1»); texto corto y en español.
- Accesibilidad: contraste 4.5:1, foco visible, teclado, nombres accesibles (`aria-label` fijo en iconos), 390 px sin recortes, video nunca como fondo de la caja.
- Peso: el build PWA tiene límite de 2 MiB por archivo (hoy el JS ronda 2.11 MB: no sumes peso; optimiza imágenes y divide código si hace falta).
- Marca: la tienda (Macgen/GV) y el producto (Nexora) no se mezclan; `PRODUCT_TENANCY_REQUIRED` separa las dos entradas.

## 4. Cómo trabajar
- Ramas desde `producto-nexora` (c6148bac o más nuevo), una por pieza: `chatgpt-pc/visual-<tema>`. Rebasa la cadena de #16 → #11 → #13 → #14 para no duplicar trabajo.
- Por cada pieza: prueba que falle antes y pase después (`pnpm exec vitest run <archivo>`, eslint, `pnpm --filter @fitstore/web build`), los 3 CI (`verify`, `windows-installer`, `render-images`) y capturas.
- Al terminar una pieza escribe `LISTA: <rama> <commit>` en `docs/diseno/OBSIDIAN_LUMINA_PROGRESO.md`. Claude nube revisa y despliega. **No despliegues ni toques Render, base ni credenciales.**
- Si te falta una decisión de marca (color principal, tono, tipografía), propón 2–3 opciones con capturas y deja que la dueña elija; no cambies la identidad aprobada sin su OK.
