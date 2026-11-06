# Resultado orden 115 · Claude PC (nube) · 6-nov-2026

Escrito aquí (rama `claude-pc/cola2-26oct`) porque no escribo en `nexora-cloud`. Solo lectura; nada desplegado.

## 1. MarkItDown (orden 114) — HECHO
- `pip install "markitdown[all]"` en un entorno virtual (fuera del repo). `markitdown --version` → 0.1.9.
- Prueba con un Excel de muestra de 2 filas creado por mí (no es dato de la tienda): convierte a tabla Markdown correcta. Sin credenciales.

## 2. Revisión sin corregir
### `claude-pc/movil-todo` @ 1b2a29a8 (CI al revisar: render-images verde; verify y windows-installer en curso)
Lectura del diff (`apps/web/src/styles.css`, `mobileTables.ts`, `App.tsx`, `Management.tsx`, `tests/e2e/movil-sin-desborde.spec.ts`). No abrí navegador a 390 px: la app necesita API y base que esta sesión no levanta; confío en las capturas de la rama y en el e2e, sin verificarlos yo.
- Sin hallazgos altos. Escritorio ≥1366 px: todo el CSS nuevo va dentro de `@media (max-width: 768px)`, salvo el cambio de `viewport-fit=cover` (inocuo en escritorio).
- Medio · `styles.css:6696-6705`: `.main-content button/select/input { min-height:44px }` afecta a TODOS los controles de las pantallas en celular, incluidos botones compactos de tablas y filtros; puede crecer filas/barras y romper alineaciones no cubiertas por el test (el test solo mide desborde horizontal, no altura ni solapes).
- Bajo · `mobileTables.ts:21-24`: el `MutationObserver` re-escanea todas las tablas en cada mutación del `<main>` (cada tecla/render). Aceptable con tablas de 20 filas; si hay listados grandes, limitar a nodos añadidos o usar `requestAnimationFrame`.
- Bajo · `mobileTables.ts:12-14`: las filas con `colspan` se saltan y la tabla igual recibe `table-cards`; esas filas (p. ej. «sin resultados» o totales) se verán como bloque sin etiqueta: confirmar visualmente en Inventario y Ventas.
- Bajo · `tests/e2e/movil-sin-desborde.spec.ts:29-34`: usa el usuario demo `admin@fitstore.demo` y su contraseña de demostración, igual que otros tests de `nexora-cloud`; no es secreto real, solo anotarlo.
- Pendiente (no hecho por mí): comprobar en navegador real Productos/Inventario/Clientes/Ventas a 390 px y escritorio ≥1366 px.

### `claude-pc/landing-norexos-net` @ d340664d (CI al revisar: render-images y windows-installer verdes; verify en curso)
- La auditoría de ChatGPT nube (`RESULTADOS_AUDITORIA_LANDING.md`, sobre `ebcb2455`) dio 4 hallazgos medios. El commit `d340664d` ya los corrige: «Vende en segundos» ya no aparece; la FAQ en inglés dice «Support is currently provided in Spanish» (`en/index.html:165-168`); no hay texto de «sucursales/hoy» sin respaldo en `index.html`. El marcador `DECIDE-DUEÑA` se mantiene (`index.html:128`, `en/index.html:126`) para planes, precios, contacto, destino del botón, disponibilidad y soporte en inglés.
- Sin precios ni promesas sin respaldo en el HTML (grep de monedas, «gratis», garantías, cumplimiento, certificaciones: sin coincidencias).
- Pendientes de la dueña/publicación (no verificables desde aquí): existencia de `norexos.net`/`app.norexos.net`, buzón `soporte@norexos.net`, cabeceras de seguridad del hosting. Pedir a ChatGPT nube que re-audite `d340664d` antes de publicar.

## 3. Orden 113 (verificación visual de reportes en vivo) — SALTADA
Exige entrar a la web de producción y abrir 8 reportes en vivo. Mis límites permanentes me prohíben tocar producción y no tengo pantalla; no usé las variables de acceso. Pendiente para la laptop con la dueña presente.

## 4. ChatGPT PC — no aplica desde la nube (sin acceso).
## 5. Orden 112 (plugin Codex) — no hecha, como indica la orden.
