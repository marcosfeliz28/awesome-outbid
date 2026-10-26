# Tarea: rediseño «Obsidian Lumina» (26-oct-2026)

La dueña aprobó la dirección visual Obsidian Lumina. Este archivo reparte el trabajo para que otro agente avance en paralelo, sin chocar con Claude nube, que está con el módulo GV.

## Quién hace qué

| Fase | Pantallas | Quién | Rama |
|---|---|---|---|
| 1 | Sistema de diseño (tokens, tarjetas, botones, formularios, tablas, vacíos, alertas, carga), marco de administración y tablero | Agente de Claude nube (en curso) | `claude/obsidian-lumina-f1` |
| 3 | Catálogo, Inventario, Clientes, Reportes y Configuración | **Agente que escoja la dueña** | `<agente>/obsidian-lumina-f3`, sacada de `claude/obsidian-lumina-f1` |
| 4 | Panel de operadora (`/plataforma`) | Después de la fase 3 | — |

**Empieza solo cuando exista `origin/claude/obsidian-lumina-f1`** (`git fetch origin`). Usa sus tokens y componentes; no crees otros nuevos. Si te falta un componente, agrégalo en el mismo archivo de componentes y dilo en tu entrega.

La base es el **producto** (`producto-nexora` / `claude/producto-mezcla-4`), porque `claude/obsidian-lumina-f1` sale de ahí. Pasarlo a la tienda (`nexora-cloud`) se hace después, al mezclar.

## Referencia visual

- Rama `origin/chatgpt-pc/obsidian-lumina-prototype`:
  - `design/obsidian-lumina/README.md`;
  - `design/obsidian-lumina/macgen-gv/` (commit `98717246`), con las pantallas de vender, cobrar, cierre ciego, tablero y GV;
  - la animación del commit `75524e49`, **solo** para la entrada y la bienvenida, nunca en pantallas de trabajo.
- **Colores:**
  - fondo `#05050A`;
  - superficies de obsidiana y zafiro sobrias;
  - esmeralda `#43E3B1` y violeta `#8B5CF6` **solo** como acento de estado o de acción.
- **Patrones:**
  - una acción principal por pantalla;
  - números tabulares (`font-variant-numeric: tabular-nums`);
  - estados con color **y** texto;
  - etiquetas explícitas;
  - mucho espacio y sin glassmorphism pesado.
- **Accesibilidad:**
  - texto con contraste de 4.5:1 o más y controles de 3:1 o más;
  - foco visible, roles ARIA y uso completo con teclado;
  - `prefers-reduced-motion`;
  - que funcione a 390 px.

## Lo que NO se toca

- **El módulo GV:** `apps/api/src/gv*.ts`, las pantallas de GV y las migraciones `*_gv*`. Lo hace Claude nube.
- **La caja de las cajeras:** `POS.tsx`, el cobro, el cierre de caja y `Tienda.tsx`. Mantiene los mismos flujos, nombres de botón, teclas F2/F4/F8/F12 y clases que usan las pruebas (`.product-card`, `.cart-items`, `.connection`, `.main-content`).
- **Pagos, la parte fiscal (NCF), seguridad y permisos, las APIs, la base de datos y las migraciones.**
- **El acceso:** el PIN de caja y la contraseña siguen siendo flujos separados. Nunca simules la entrada ni una recuperación de clave.
- **`.github/workflows`, Render, credenciales y los datos de producción.**
- **Los nombres de las variables de estilo** que lee `tests/accessibility-contract.test.ts`: puedes cambiar su valor, no su nombre.

## Pruebas antes de entregar

- `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- `pnpm test`, incluida `tests/accessibility-contract.test.ts`.
- Las pruebas e2e de las pantallas que cambies (`tests/e2e/*.spec.ts`): catálogo, inventario, clientes, reportes y configuración.
- Capturas de antes y después de cada pantalla, a 1366×768 y a 390×844, en `docs/diseno/obsidian-lumina/f3/`.

## Entrega

- Haz push a tu rama o abre un PR hacia `claude/obsidian-lumina-f1`. **No despliegues:** solo Claude nube despliega, y con los 3 CI en verde (`verify`, `windows-installer`, `render-images`).
- Agrega un resumen de qué cambiaste, las capturas y los riesgos en `docs/diseno/OBSIDIAN_LUMINA_PROGRESO.md`, en una sección «Fase 3».
