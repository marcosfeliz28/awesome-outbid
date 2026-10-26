# Obsidian Lumina · Fase 3 · Reportes

Rama `claude-pc/lumina-f3-reportes`. Solo visual y de estructura: no cambian cifras, fórmulas, consultas ni exportaciones.

## Cambios y por qué

- **Cabecera**: `Heading title="Reportes"` con `eyebrow={false}`. Se quitó la frase «Los números cuentan tu historia». Una acción principal (**Excel**) y **PDF** dentro de «Más». Los botones conservan su nombre y la misma función de descarga (ahora un solo `exportReport`). Con fechas invertidas ambos quedan deshabilitados (antes se podía pedir un archivo con un rango inválido). En «Formal» (DGII) e «Ingresos por día» no se muestran, porque esos paneles traen sus propias acciones.
- **Catálogo (`groupReports`)**: sin cambios de datos. Títulos de grupo en tamaño legible y sin mayúsculas forzadas; el reporte actual se marca con barra violeta, negrita, texto «Actual» y `aria-current`, no solo con color. Filas de 44 px.
- **Tabla**: columnas numéricas alineadas a la derecha, cifras tabulares en todas las celdas; los negativos conservan su signo «-» y además van en color de peligro. Panel con filtros apilados a 390 px, foco visible en el contenedor desplazable.
- **Carga y errores**: `TableSkeleton` mientras carga; el error sigue en `QueryState` y el rango invertido en `.form-error`. El vacío usa el existente («No hay datos para este período»).
- Nada de color decorativo: violeta para lo actual, esmeralda solo como foco.

## Archivos

- `apps/web/src/Management.tsx` (solo `Reports` y 2 líneas de import: el CSS y `TableSkeleton` en una línea aparte para no chocar con otros agentes).
- `apps/web/src/lumina-reportes.css` (nuevo).
- No se tocó `admin-ui.tsx` ni `FormalReports.tsx`.

## Pruebas

Ver el reporte de entrega para los resultados exactos (typecheck, lint, build y accessibility-contract pasaron; e2e al final de este archivo).

## Sin verificar

- Capturas a 1366×768 y 390×844 y contraste medido: no se hicieron. Lo hecho a 390 px se apoya en reglas CSS, no en una medición.
- Los e2e existentes solo recorren la navegación a «Reportes»; ninguno ejercita las exportaciones, así que Excel/PDF no tienen cobertura automática aquí.

## Riesgos

- Quien buscara «PDF» a simple vista ahora lo encuentra en «Más».
- La alineación se decide por el tipo de la primera fila; si la primera fila trae `null` en una columna numérica, esa columna queda a la izquierda.
- La etiqueta «Actual» aparece al lado del nombre en el menú; en pantallas muy angostas puede cortar nombres largos.

## Resultados de pruebas (puertos propios: web 4184, API 3184, PostgreSQL 55184, ya eliminado)

- `pnpm typecheck`, `pnpm lint`, `pnpm build`: pasaron.
- `tests/accessibility-contract.test.ts`: 36/36.
- `tests/e2e/fuentes.spec.ts`: 9/9 (recorre «Reportes»).
- `tests/e2e/accesibilidad.spec.ts` «G12: pantallas» (incluye `reports`, 390 y 1280 px, claro y oscuro): 4/4. Una primera corrida lanzada junto a `store.spec.ts` falló en Alertas por `.loading` (tiempo de espera, no es Reportes) y pasó al repetirla sola.
- `tests/e2e/store.spec.ts`: no se completó. Dos pruebas fallaron por conectarse con Prisma a la base por defecto (no la mía) y la corrida se detuvo por lentitud. Solo usa «Reportes» para navegar.
- `pnpm test` completo: no se corrió.
