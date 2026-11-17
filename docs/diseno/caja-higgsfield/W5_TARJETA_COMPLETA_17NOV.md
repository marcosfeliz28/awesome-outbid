# W5 · Tarjeta completa junto al cobro

## Evidencia de entrada

- Base remota: `243bfdb81499c93dbee35ea977372ec7089742d0`.
- Árbol equivalente local: `f36f4ee46996fce95e42193e54f0b6f41ac63c7f`.
- CI `44184570503`: 151 pruebas E2E pasan y cuatro W5 fallan en
  `tests/e2e/pos-pantalla.spec.ts:73` (1280×720, 1366×768, 1536×864, 1024×768).
- Captura de fallo del artefacto `14376046340`, inspeccionada: a 1280×720
  la primera tarjeta comienza aproximadamente en y=454 y su imagen ocupa
  192 px antes del texto. El título largo completo a 20 px sale de la ventana.
  La comprobación de desborde horizontal anterior sí pasa.

## Cambio limitado

Solo `apps/web/src/fusion-caja-higgsfield.css`. Para escritorios de altura
hasta 900 px se compactan separación/cabecera y fotografía a 100 px; las
columnas respetan un mínimo de 260 px para evitar títulos excesivamente
estrechos. El nombre sigue completo, con 16 px y salto de línea; no se oculta
sabor, talla ni presentación. La tarjeta no se estira a la altura de otra.

No se modifican tests existentes, JSX, manejadores, cálculos, API, descuentos,
stock, cobro, permisos, carrito ni cola sin conexión. El móvil y escritorios
más altos conservan las reglas previas. Sin merge ni producción.

## Verificación local

- Typecheck web, lint completo y build web: pasan.
- Tres contratos de presentación reversible: pasan.
- `pnpm check`: typecheck y lint pasan; 1034 pruebas pasan, 48 omitidas,
  12 fallan (16 suites fallidas). Fallo ambiental de PostgreSQL embebido:
  `libicuuc.so.60: cannot open shared object file`. No es un check verde;
  la etapa build del agregado no se ejecuta. Build web se ejecutó aparte.
- Chromium cloud: no inicia por restricción de socket del entorno.

## QA de escritorio aislada (Windows)

Chromium con fuentes reales, respuestas API DEMO locales y el nombre hostil
completo de 120 caracteres. No se modificó `tests/e2e/pos-pantalla.spec.ts`.

| Ventana | Borde inferior de primera tarjeta | Carrito / Cobrar | Desborde |
|---|---:|---|---:|
| 1280×720 | 715 px | dentro / dentro | 0 |
| 1366×768 | 695 px | dentro / dentro | 0 |
| 1536×864 | 696.53 px | dentro / dentro | 0 |
| 1024×768 | 714.19 px | dentro / dentro | 0 |

Se verificó geometría W5 en los cuatro tamaños con el harness DEMO. Esto no
sustituye la suite E2E con API real de CI. El harness combinado adicional
`visual-caja-higgsfield.spec.ts` pasa tres casos y falla uno: a 1280×720 su
requisito de tres filas de carrito completas ve dos. Carrito y Cobrar sí
caben; no se alteraron sus estilos en este parche. La comparación de ese
caso con la base y los tres controles de GitHub quedan pendientes.

Capturas: copia aislada Windows `dot-qa-pos-w5-17nov`, carpeta
`test-results/higgsfield-caja-visual`. No producción ni datos reales.

