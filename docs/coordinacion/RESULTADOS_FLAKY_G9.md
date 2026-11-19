# Resultados · intermitente G9 (cierre por inactividad)

Prueba: `tests/e2e/privacidad-sesion.spec.ts:155` «G9: el cierre por inactividad también borra clientes y catálogo del navegador». Rama `claude-pc/flaky-g9`.

## Síntoma en CI

En los dos fallos (0810d76b, run 41750183327 intento 1; ebcb2455, run 42018212485 intento 1) falla la misma línea: `getByText('Sesión cerrada por inactividad.')` no aparece en 20 s. Las trazas de los dos artefactos dicen lo mismo:

- `POST /auth/logout` sale 12–40 ms después de `clock.fastForward("31:00")`: el cierre por inactividad **sí** ocurrió y la pantalla quedó en el inicio de sesión.
- No hay errores de página. En el video no aparece ningún aviso después del cierre, y el aviso anterior «Cambios guardados.» (de abrir la caja, menos de 1 s antes) también desaparece.

Se descartan las hipótesis del pedido: el borrado de IndexedDB y de Cache Storage terminó, no hubo excepción en `endSession`/`forgetSessionData`/`keepDraftThrough` y la prueba no recarga la página.

## Causa raíz

`Toasts` (apps/web/src/helpers.tsx) cerraba con `onClose={() => setInfo(null)}`, es decir, cerraba **el aviso que estuviera a la vista**, no el propio. `clock.fastForward` dispara uno por uno, en orden de creación, todos los temporizadores vencidos, con una pausa real entre cada uno:

1. Primero se dispara el intervalo de inactividad. El cierre termina dentro del mismo `fastForward` y llama a `toast("Sesión cerrada por inactividad.")`.
2. Luego se dispara el temporizador de 6 s de «Cambios guardados.». Normalmente React ya lo desmontó (`effect-clear`) y no pasa nada. Pero si vence **entre** `toast()` y esa limpieza (pasa en un equipo lento como el runner), su `onClose` borra el aviso nuevo.

El mismo choque puede pasar en la tienda: un aviso viejo que vence justo cuando llega uno nuevo lo borra antes de que la cajera lo lea.

Evidencia (registro temporal de `toast()`, `fire-close` y `effect-clear` en una compilación local, sin commit):

- sin ralentizar: `toast() S → effect-clear C` (pasa);
- CPU ×10: `fire-close C → toast() S` (pasa);
- CPU ×3, corrida que falló: `toast() S → fire-close C → effect-clear C`, con el mismo error que en CI.

## Arreglo

`closeOwn(id)`: cada aviso cierra sólo si sigue siendo el que está a la vista (`setInfo(closeOwn(info.id))`, igual para el de error). No se tocó la prueba, el cierre por inactividad ni lo que se borra del navegador: sigue borrando clientes, catálogo y respuestas de la API (G9).

Regresión: `tests/avisos-propios.test.ts` (en `pnpm check`). Falla sin el arreglo (`closeOwn is not a function`) y pasa con él.

## Corridas (local, PostgreSQL 16, API dev, `vite preview`)

| Condición                                  | Antes                          | Después            |
| ------------------------------------------ | ------------------------------ | ------------------ |
| G9 inactividad, sin carga                  | 20/20 pasan                    | —                  |
| G9 inactividad, 6 procesos de CPU al 100 % | 30/30 pasan                    | —                  |
| G9 inactividad, CPU ×2,5 / ×3 / ×3,5 (CDP) | **3 fallos en 90** (2 + 1 + 0) | **0 fallos en 90** |
| privacidad-sesion.spec.ts completo ×10     | —                              | 30/30              |
| caja-borrador + cuatro-cajas ×3            | —                              | 15/15              |

`pnpm check`: typecheck y eslint OK. Las 14 suites `*-postgres` no corren en esta sandbox (`initdb` como root, Permission denied); el CI sí las corre.

## Seguridad-20

1 y 18: sin llaves en el diff (`git diff | grep sk-ant|api_key…`, vacío). 7: sin `innerHTML`, el aviso se sigue mostrando como texto. 5/G9: no cambia lo que se borra al cerrar sesión. 13 y 14: sin dependencias nuevas. 20: hay una prueba que falla antes y pasa después. 2, 3, 4, 6, 8–12, 15–17 y 19 no aplican (no se tocó API, rutas, base ni variables).

## SHA y CI

- SHA del arreglo: `34c3d6a2e295bf20af0e18461a2dec9f8300fbdf` (rama `claude-pc/flaky-g9`).
- CI run 42223134508, intento 1, sin relanzar: verify ✅ (e2e completa, incluida G9), windows-installer ✅, render-images ✅.
- No se mezcló en nexora-cloud ni se desplegó.
