# Auditoría de Claude nube: `dot/inicio-integracion-revision-pc` @ `4e4bb76f` (17-nov-2026)

Revisión funcional y de seguridad, sin tocar la rama ni el diseño. Fuente: diff contra `nexora-cloud` (`c0cdc2a8`) y el informe de pruebas de GitHub (ejecución 44138111994).

## Pruebas automáticas

| Prueba | Resultado |
|---|---|
| windows-installer | verde |
| render-images | verde |
| verify | **rojo: 11 pruebas de pantalla** |

## Bloqueantes

1. **La caja (POS) se rompe.** La barra nueva de idioma y apariencia (`.fusion-preferences`, en `apps/web/src/App.tsx`, encima de `header.topbar`) aparece en **todas** las pantallas, no solo en Inicio, y empuja la caja hacia abajo:
   - `pos-pantalla.spec.ts` W5: a 1024×768, 1280×720, 1366×768 y 1536×864 ya no se ven a la vez el catálogo y «Cobrar».
   - `caja-web.spec.ts` A5 (1366×768): el carrito mide 821 px, más que la pantalla (768).
   - `fuentes.spec.ts` y `solicitud-anulacion.spec.ts`: la barra superior se desborda a 320 px (36 px de más).
   Sugerencia (decide Dot): mostrar esa barra solo en Inicio (`page === "dashboard"`), o dentro de la barra superior sin agregar alto.
2. **Cambio de nombre de la marca: «Norexos» → «Noxeros».** Aparece en `apps/web/index.html` (título), en «Acerca de», en el aviso de privacidad, en el menú y en la clave `noxeros-overview-language`. Parece un error de tipeo. Rompe `acerca-de.spec.ts` (×2) y `caja-web.spec.ts` 03-A1, que buscan «Acerca de Norexos». Si el nombre debe cambiar, lo decide Marcos y se cambia en todo a la vez.

## Sin hallazgos

- No hay llamadas nuevas a la API, ni `fetch`, `innerHTML`, `eval`, direcciones externas o tokens.
- El idioma y el color de acento se guardan en `localStorage` con `try/catch` (si falla el almacenamiento, la app sigue funcionando).
- No se tocan permisos, dinero, base de datos ni instalador.

## Observaciones (no bloquean)

- El alcance va más allá de Inicio: el menú, la barra superior y el título de toda la app pasan por `t()` (español/inglés). El aviso dice que el inglés solo cubre Inicio y la navegación.
- Hay 7 archivos de `docs/sistema/` con anclas actualizadas: conviene confirmar que sus pruebas pasan cuando se arregle lo de arriba.

Publicación: **no**, hasta que `verify` esté verde, Marcos vea las capturas reales y lo acepte.

## Actualización: `dot/inicio-accesos-movil-17nov` @ `eb20caab` (17-nov, 20:40 UTC)

- **Bloqueante 1 (Caja): corregido en el código.** La barra de idioma y apariencia ahora sale solo en Inicio (`page === "dashboard"`, `App.tsx:1098`). Falta confirmarlo con `verify` en verde (en curso; en `46ae8830` y `1d0d0dcd` salió rojo).
- **Bloqueante 2 (marca): sigue, y ahora mezclado.** El commit `1d62b760` cambió las pruebas para aceptar «Noxeros». Quedan «Noxeros» en 3 archivos (`index.html`, `App.tsx`, `inicioLanguage.ts`) y «Norexos» en otros 10 de `apps/web`. La marca debe ser una sola: **decide Marcos** (Norexos o Noxeros) y se cambia en todo a la vez.
- Archivos fuera de `apps/web/src`/`tests`/`docs`: `apps/web/index.html`, `playwright.visual-inicio.config.ts`, `vitest.config.ts`, `vitest.inicio-integrado.config.ts` (configuración de pruebas; sin riesgo).

### Resultado de `verify` en `eb20caab` (ejecución 44169472399): rojo, **un solo fallo**

- `tests/e2e/store.spec.ts:148` «pantallas de gestión, tema oscuro y versión móvil»: `getByRole('button', { name: 'Punto de venta', exact: true })` encuentra **dos** botones: el del menú lateral y el de «Accesos rápidos» (`.fi-shortcut`).
- Arreglo sugerido (igual al que usó Claude en `31ef9877`, que dejó `verify` verde): darle a cada botón de Accesos rápidos un nombre accesible propio, por ejemplo `aria-label="Ir a Punto de venta"` (y lo mismo para Inventario y Reportes). El texto visible no cambia.
- Lo demás pasó: la Caja ya no se desborda.

### Decisión de Marcos (17-nov): la marca es **Norexos**

Dot: devolver «Noxeros» a «Norexos» en `apps/web/index.html`, `apps/web/src/App.tsx`, `apps/web/src/inicioLanguage.ts` (incluida la clave `noxeros-overview-language`) y revertir las pruebas que cambió `1d62b760` (`tests/e2e/acerca-de.spec.ts`, `tests/e2e/caja-web.spec.ts`, `tests/inicio-integrado.test.ts`).

## Auditoría: `dot/pos-viewport-w5-17nov` @ `59d77a17` (Inicio + Caja, 17-nov, 23:10 UTC)

- **3 pruebas automáticas en verde** (verify, windows-installer, render-images).
- **Marca:** «Norexos» en todo (0 «Noxeros»). Resuelto.
- **Caja (`POS.tsx`):** solo textos pasados por `t()` y un componente de preferencias visuales (`CajaVisualPreferences`). Sin cambios en cobro, totales, descuentos, teclado ni sincronización.
- **Accesos rápidos (`QuickAccessOverview`):** respetan los mismos permisos del menú; no escriben nada.
- Sin llamadas nuevas a la API, `innerHTML`, `eval`, direcciones externas ni tokens. Sin cambios en API, base de datos, instalador ni Render.
- Capturas reales: `chatgpt-pc/capturas-dot-243bfdb8` (Caja) y `chatgpt-pc/capturas-dot-eb20caab` (Inicio). Falta una captura del commit exacto `59d77a17`.

**Veredicto técnico: apto.** Se publica solo con la aceptación de Marcos de las capturas reales.

`dot/inventario-higgsfield-17nov` @ `b78f2166`: `verify` **cancelada**; hay que volver a correrla antes de auditar.
