# Auditoría de usuario · web Norexos · 31-oct-2026

**Alcance:** https://nexora-pos-web.onrender.com (rediseño desplegado, commit `ae63fb6d`).
**Método:** Playwright (Chromium), solo lectura. Sin cobrar, sin abrir/cerrar caja, sin editar datos.
**Credenciales:** `NEXORA_CLAUDE_USER` y `NEXORA_CLAUDE_PASSWORD` **no están en el entorno**. Por eso solo se audita lo público. Todo lo de sesión iniciada queda **NO COMPROBADO**.

## Resultado corto
- Sin hallazgos de gravedad **alta**.
- La pantalla de entrada carga, tiene el título correcto, no tiene desbordes horizontales y no muestra textos viejos («Nexora» / «POS») en los cuatro tamaños.
- Hallazgos **medios/bajos**: un error 400 en consola al cargar, letra de 14 px en algunos textos y foco visible dudoso en los campos de entrada.

## Tabla de hallazgos

| pantalla | rol | tamaño | hallazgo | gravedad | captura |
|---|---|---|---|---|---|
| Entrada (login) | público | 1280×720, 1366×768, 1536×864, 390×844 | Carga en 2.0–2.9 s (<3 s). Título «Norexos · Punto de venta e inventario». Sin desborde horizontal. Sin «Nexora»/«POS» visibles. | — (OK) | `capturas-31oct/login-*.png` |
| Entrada (login) | público | todos | Al cargar, la consola muestra `400 Bad Request` en `/api/auth/refresh`. Probablemente es el intento de renovar sesión sin cookie; no confirmado. Un usuario no lo ve, pero aparece en DevTools. | baja | — |
| Entrada (login) | público | 1280–1536 px | 16 elementos con texto a **14 px** (base pedida: ≥16 px). En 390 px, 5 elementos a 14 px. No pude identificar cuáles sin revisar el DOM a fondo. | baja | — |
| Entrada (login) | público | 1366×768 | Clave falsa con usuario inexistente: mensaje claro «Usuario o contraseña incorrectos.» (no revela cuál falla). | — (OK) | — |
| Entrada (login) | público | 1366×768 | Tab recorre en orden lógico: usuario → contraseña → mostrar contraseña → entrar. El campo de texto tiene `outline: none`; el foco visible depende de un estilo que no revisé (¿sombra?). | media (por confirmar) | — |
| Entrada (login) | público | 390×844 | Layout de una columna, texto y botón visibles sin desbordar. | — (OK) | `capturas-31oct/login-390x844.png` |

## Lo que NO está comprobado (y por qué)
- **Todas las pantallas dentro de sesión** (POS, Inventario, Caja, Reportes, Clientes, Ajustes…): falta usuario y clave en el entorno.
- **Permisos por rol** (vendedora sin costo/utilidad/margen; pantallas vacías por falta de permiso): requiere sesión.
- **Teclado en el POS** (F2/F4/F8/F12) y **cola offline** del carrito: requiere sesión y no se simuló un cobro.
- **Vista previa de recibo / leyenda no fiscal**: requiere una venta.
- **Accesibilidad con axe** en pantallas internas: no se corrió; solo se revisó la entrada a ojo y por código de foco.
- **Rendimiento por pantalla** (LCP, peso de JS): solo se midió la carga de la entrada.
- **Tamaño de letra de cada pantalla interna**: solo se midió la entrada.

## Capturas
Solo la pantalla de entrada, sin datos de clientes ni claves (las capturas se tomaron con los campos vacíos):
- `docs/auditoria/capturas-31oct/login-1280x720.png`
- `docs/auditoria/capturas-31oct/login-1366x768.png`
- `docs/auditoria/capturas-31oct/login-1536x864.png`
- `docs/auditoria/capturas-31oct/login-390x844.png`

## Para pasar a PENDIENTES (no son altos)
1. Revisar el `400` de `/api/auth/refresh` al cargar sin sesión; si es esperado, no es un fallo.
2. Localizar los 14 px del login y subirlos a 16 px si son texto de lectura.
3. Confirmar el foco visible de los campos (`outline: none` en el login).

## Para repetir con credenciales
Cuando estén en el entorno (`NEXORA_CLAUDE_USER` / `NEXORA_CLAUDE_PASSWORD`, vía `docs/coordinacion/claude-nube/entrar.py`), habría que correr el recorrido completo por rol (vendedora, gerente, dueña), con pantallas de `docs/sistema/PANTALLAS.md`, permisos y axe. Eso no se hizo.
