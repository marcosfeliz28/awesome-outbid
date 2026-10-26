# Obsidian Lumina · fase 3 · Configuración

Rama `claude-pc/lumina-f3-config`. Solo disposición visual; no cambia lógica, textos de campos, validaciones ni flujo de datos.

## Cambios y por qué

- **Cabecera:** `Heading title="Configuración" eyebrow={false}` (el `h1` era «A la medida de tu negocio»; ahora coincide con la ruta). No hay acciones superiores: «Editar configuración» sigue siendo la única acción primaria, dentro de su tarjeta.
- **Pestañas:** se conservan como botones con los mismos nombres («Negocio y reglas», «Usuarios y permisos», «Bitácora», «Equipos»; los leen e2e y `accessibility-contract.test.ts`). La activa lleva `aria-current="page"`, subrayado y negrita (no solo color); foco esmeralda de 3 px; alto mínimo 44 px.
- **Tarjetas con título y descripción:** «Tu negocio» (el nombre del negocio pasa de `h2` a `h3` debajo), «Equipo de tu tienda», «Permisos por rol» y «Bitácora» llevan título y una línea de descripción.
- **Texto suelto:** los cuatro avisos de la pestaña Negocio (topes de crédito en 0, crédito deshabilitado, tasa del dólar retenida, margen bajo) pasan de `.cod-hint` a `.notice warning|danger` (tokens que funcionan en claro y oscuro), con los mismos `role` y texto.
- **Carga:** `TableSkeleton` mientras cargan usuarios y bitácora (solo si la consulta está pendiente y no en pausa; el estado sin conexión y los errores siguen en `QueryState`).
- **Móvil 390 px:** una columna, botones y enlaces de acción a 44 px, tarjetas de rol a 56 px, sin desplazamiento horizontal.
- **Números tabulares** en reglas y montos; `prefers-reduced-motion` sin transiciones.

## Archivos

- `apps/web/src/Management.tsx`: solo dentro de `Configuration` y la línea de importación de `admin-ui` (ahora `{ MoreMenu, TableSkeleton }`) más `import "./lumina-config.css";`.
- `apps/web/src/lumina-config.css` (nuevo).
- Este documento. No se añadió nada a `admin-ui.tsx`.

## Pruebas

Entorno propio: web 4185, API 3185, PostgreSQL 55185 (clúster desechable, ya eliminado). Resultados:

- `pnpm install --frozen-lockfile`, `pnpm db:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build`: sin errores.
- `tests/accessibility-contract.test.ts`: 36 de 36 pasan.
- e2e (contrasenas, fuentes, respaldo-drive, accesibilidad, almacenes, incentivos y las 2 pruebas de Configuración de store.spec): todas pasan (36 + 3). Incentivos falló la primera vez por no tener `DATABASE_URL` en el proceso de la prueba; con la URL de la base desechable pasa.
- `store.spec.ts` completo: no terminó en el tiempo límite (se cortó en la prueba 66 de 76, antes de acabar). Un fallo visible, «R9 códigos» (caja, no Configuración), también era por `DATABASE_URL` ausente. No se repitió el archivo entero.
- No se corrió `pnpm test` completo (solo el contrato de accesibilidad).

## Sin verificar / límites

- **No se tocaron** los componentes sensibles (`StoreSettings`, `NcfSequenceSettings`, `SupportAccessCard`, `DriveBackupCard`, `TelegramNotices`, `IncentiveRates`, `WarehousesPanel`, `ResetPassword`, `Equipment`): conservan su propio aspecto. Por eso «Sin logo» (en `Tienda.tsx`) y los campos del modal `FormModal` (ayudas con `aria-describedby`, errores `.form-error`) no se rediseñaron aquí; `FormModal` es compartido y queda fuera de alcance.
- No se midió contraste con herramienta; se usan los tokens existentes (`--muted`, `--primary`, `.notice`).
- No se hicieron capturas.

## Riesgos

- El `h3` del nombre del negocio: cualquier prueba que lo buscara como `heading` nivel 2 fallaría (no se encontró ninguna).
- Cambiar de `.cod-hint` a `.notice` altera ligeramente el aspecto de esos avisos (borde lateral y fondo); es intencional.
