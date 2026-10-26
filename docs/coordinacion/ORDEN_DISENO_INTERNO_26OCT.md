# Orden de diseño: pantallas de adentro al nivel de la portada (26-oct-2026)

La dueña eligió la **«Edición Ejecutiva Definitiva V2»** como el estilo de todo Nexora. Claude nube hace solo la portada y la entrada (rama `claude/portada-lumina-v2`). **Las pantallas de adentro las diseña ChatGPT** con el mismo lenguaje visual. Claude nube revisa, prueba y despliega.

## Referencia (en esta rama, `claude/orden-diseno-interno`)
- `design/obsidian-lumina/portada-v2-ejecutiva/referencia-original.html`: la maqueta completa (ábrela en el navegador). Mira la Vista 1 (portada y bóveda de acceso).
- `design/obsidian-lumina/portada-v2-ejecutiva/emblema-prisma.jpeg`: el emblema.
- Base de código: `origin/claude/producto-mezcla-4` (producto en vivo, ya con Obsidian Lumina f1 y f2).

## El lenguaje visual (de la maqueta)
| Elemento | Valor |
|---|---|
| Fondo | `#05050A`; elevado `#0B0C16`; rejilla de 48 px al 2,5 % |
| Acentos | violeta `#7C3AED`, esmeralda `#10B981`, azul `#3B82F6`; solo como estado o acción |
| Luz ambiental | 4 gradientes radiales (violeta, esmeralda, azul); uno sigue al mouse |
| Tarjeta | `obsidian-card`: degradado 165° `rgba(19,21,36,.78)`→`rgba(10,11,20,.88)`, borde `rgba(255,255,255,.11)`, luz superior interior, sombra profunda; al pasar el mouse el borde se vuelve violeta |
| Línea láser | franja de 1 px violeta→esmeralda→azul que se desplaza (4,8 s), bajo la cabecera |
| Tipos | títulos Plus Jakarta Sans 700–800, interlineado -0,03 em; texto Inter; cifras JetBrains Mono con `tabular-nums` |
| Cápsulas de estado | texto mono en mayúsculas, color y texto a la vez, punto pulsante |
| Campos | etiqueta en mayúsculas pequeña; al enfocar: borde esmeralda, halo violeta y los demás campos se atenúan |
| Botón principal | degradado esmeralda→verde agua, texto oscuro, brillo; **uno por pantalla** |
| Emblema | halo que pulsa (4 s) |

## Reglas de oro (no negociables)
1. **Las cajeras ven la versión CLARA por defecto**; el administrador puede alternar claro/oscuro. Diseña los dos temas con los mismos tokens.
2. **No cambiar:** flujos, nombres de botón, teclas F2/F4/F8/F12, clases `.product-card`, `.cart-items`, `.connection`, `.main-content`, ni los `data-testid`/roles que usan `tests/e2e` y `tests/accessibility-contract.test.ts` (puedes cambiar el valor de las variables CSS, no su nombre).
3. **Arqueo ciego:** la cajera con caja abierta no ve importes ni totales de ventas hasta cerrar.
4. **Ganancia:** (precio − costo)/precio, sin restar ITBIS. El tablero abre en «Hoy».
5. **No tocar:** GV (`apps/api/src/gv*`, `Gv.tsx`, migraciones `*_gv*`), pagos, NCF/DGII, seguridad y permisos, APIs, base de datos, migraciones, `.github/workflows`, Render, credenciales.
6. **Prohibido en la interfaz:** cifras de marketing no medidas («0,4 s», «0,00 % fugas»), datos de ejemplo, credenciales o PIN de demostración, simular entrada o recuperación de clave.
7. **Accesibilidad:** contraste de texto 4,5:1 o más y controles 3:1; foco visible; ARIA; teclado completo; `prefers-reduced-motion` sin animación; sin `backdrop-filter` obligatorio (alternativa sólida para equipos modestos); funciona a 390 px.
8. **Animaciones** (láser, halo, luz del mouse) solo en cabecera, entrada y bienvenida; nunca en pantallas de trabajo con muchos datos.

## Reparto
| Quién | Pantallas | Rama |
|---|---|---|
| **ChatGPT PC** (tiene navegador) | Caja/POS en claro (vender, cobrar, cierre ciego), tablero «Hoy» de la dueña, marco de administración (menú lateral, cabecera con línea láser, selector claro/oscuro) | `chatgpt-pc/lumina-adentro-a` |
| **ChatGPT nube** | Catálogo, Inventario, Clientes, Reportes, Configuración, Mercancía/Equipos, Asistente | `chatgpt-nube/lumina-adentro-b` |

Ambos sacan la rama de `origin/claude/producto-mezcla-4`. Primero el marco de administración (ChatGPT PC) fija componentes; ChatGPT nube usa los mismos componentes y **no crea otros**: si falta uno, lo agrega en el archivo común y lo dice en la entrega. Claude PC deja en pausa su fase 3.

## Entrega
- Pruebas: `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test`, e2e de cada pantalla que cambies.
- Capturas antes/después a 1366×768 y 390×844 en `docs/diseno/obsidian-lumina/adentro/`.
- Resumen, riesgos y qué dejaste fuera en `docs/diseno/OBSIDIAN_LUMINA_PROGRESO.md`, sección «Adentro».
- **No despliegues y no toques Render:** solo Claude nube despliega, con los 3 CI en verde (`verify`, `windows-installer`, `render-images`).
- Entrega por pantalla (un commit por pantalla) para poder subir por fases.

## Orden de prioridad
1. Marco de administración + selector claro/oscuro (ChatGPT PC).
2. Caja/POS clara (ChatGPT PC) y Catálogo + Inventario (ChatGPT nube).
3. Tablero «Hoy», Clientes, Reportes, Configuración.
