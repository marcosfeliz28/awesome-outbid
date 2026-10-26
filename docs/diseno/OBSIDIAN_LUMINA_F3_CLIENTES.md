# Obsidian Lumina · Fase 3 · Clientes

Rama `claude-pc/lumina-f3-clientes`. Solo visual y estructura; sin cambio de comportamiento.

## Cambios y por qué

- **Cabecera:** `Heading title="Clientes"` con `eyebrow={false}`; se quitó el eslogan «Personas que vuelven a elegirte» y la etiqueta en mayúsculas. Subtítulo: «Consulta, busca y actualiza los datos de tus clientes.» Una sola acción primaria («Nuevo cliente», mismo nombre accesible y manejador). No hay otras acciones de cabecera, así que no se usa `more`.
- **Tabla:** `DataTable cards` (en 390 px cada fila es una tarjeta, sin desplazamiento horizontal). Compras, total gastado y última compra con números tabulares. Contacto en dos líneas con el correo legible.
- **Carga:** `TableSkeleton` mientras la consulta está pendiente (no si está en pausa sin conexión: ahí sigue el aviso de `QueryState`).
- **Vacío:** se conserva el estado vacío existente («No encontramos clientes» + qué hacer).
- **Acciones de fila:** «Editar» y «Anonimizar» con área táctil de 44 px y foco visible (`--focus`).
- **Privacidad:** intacta. No se tocó `seesCustomerPii`, `customerPrivateDisplay`, `customerEditValue` ni `CustomerPrivacyNotice` (sigue dentro de los formularios «Nuevo cliente» y «Editar cliente»).
- Color: sin acentos nuevos; solo tokens existentes (violeta en «Editar» por `.text-link`, rojo de peligro en «Anonimizar»).

## Archivos

- `apps/web/src/Management.tsx`: función `Customers` + dos líneas de import tras la de `MoreMenu` (`./lumina-clientes.css` y `TableSkeleton` de `./admin-ui`).
- `apps/web/src/lumina-clientes.css` (nuevo).
- Nada añadido a `admin-ui.tsx`. Sin cambios en e2e: la ruta de clics no cambió.

## Pruebas

- `pnpm install --frozen-lockfile`, `db:generate`, `typecheck`, `lint`, `build`: OK.
- `tests/accessibility-contract.test.ts`: 36 de 36 pasan.
- e2e (web 4183, API 3183, PostgreSQL 55183 propios): privacidad-sesion, fuentes, accesibilidad, store, credito = 65 pasan, 1 falla (`privacidad-sesion` «cierre por inactividad», reloj simulado, dentro de la corrida larga de 16 min); repetida sola pasa 3 de 3. No se comprobó si falla igual sin este cambio.
- Comprobación puntual a 390 px: sin desplazamiento horizontal, botones de fila de 44 px, sin eyebrow.

## Sin verificar / riesgos

- No se hicieron capturas ni se midió contraste con axe (no hay `NEXORA_AXE_SCRIPT`).
- Dos líneas de import en vez de una: pueden chocar al mezclar con otras pantallas de la fase 3 (resolución trivial).
- El cambio de título a «Clientes» puede chocar con pruebas externas que busquen el título anterior (no hay ninguna en este repo).
