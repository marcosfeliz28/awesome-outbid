# Obsidian Lumina · renovación de Nexora POS

Estado: fase 1 implementada y validada localmente; entrega para revisión en [PR #8](https://github.com/marcosfeliz28/awesome-outbid/pull/8). El estado actualizado del CI remoto se consulta en el PR. Sin despliegues.
Fecha: 26 de octubre de 2026.
Rama: `chatgpt-nube/obsidian-lumina-fase1`, desde `producto-nexora` (`2f147d2`).

## Dirección y referencias

Orden de la dueña: renovar la plataforma por fases, empezando por administración. Base #05050A, superficies obsidiana/sapphire, esmeralda #43E3B1 para acciones y violeta #8B5CF6 como acento. Espaciado tranquilo, texto claro, movimiento mínimo y accesibilidad operativa.

Referencias leídas en `chatgpt-pc/obsidian-lumina-prototype`:
- `design/obsidian-lumina/README.md`, prototipo v2 y fondo original (0819b9e7).
- `design/obsidian-lumina/macgen-gv/README.md` y tablero de la dueña (98717246).

Se adoptan la paleta, la jerarquía y las superficies. Se conservan Inter/Plus Jakarta ya empaquetadas para evitar nuevas fuentes remotas. El fondo de prisma sirve de dirección artística; no se coloca detrás de tablas o controles. Las cifras, personas, agenda GV, cobros y accesos de las maquetas son ejemplos: no se incorporan al producto. No se copiaron scripts de autenticación ni afirmaciones de velocidad/fiscalidad.

## Auditoría de estructura actual

| Área | Implementación actual | Decisión |
|---|---|---|
| Shell y navegación | `apps/web/src/App.tsx`, función Shell; navegación filtrada por permisos, menú móvil a 780 px | Conservar rutas, filtros y handlers; mejorar presentación y semántica |
| Estilos | `apps/web/src/styles.css`, reglas globales y varias redefiniciones responsive | Añadir capa acotada, cargada al final, sin reescribir toda la hoja |
| Primitivas | `packages/ui/src/index.tsx`: Button, Badge, Empty, Loading y Modal | Mantener API; añadir Card, Field, Alert y TableFrame |
| Dashboard | `Dashboard.tsx`, `YearPie.tsx`, `MonthReport.tsx` | Hereda superficies; reorganización funcional/jerárquica en fase 2 |
| Gestión | `Management.tsx`, `Merchandise.tsx`, `Purchases.tsx`, importación y paneles especializados | Migración vista por vista en fase 3 |
| IA | `Assistant.tsx` y CSS propios | Integración visual específica en fase 2, sin cambiar herramientas ni permisos |
| Operadora | `PlatformPanel.tsx`, ruta `/plataforma`, entrada independiente en main | Fase 4 |
| Venta y autenticación | POS, login web, cambio de usuario con PIN, recuperación | No incorporar flujos demo; mantener separación real |

Riesgos comprobados antes de editar: Modal usa portal a body, por eso los tokens deben alcanzar html; impresión también utiliza estilos globales; el breakpoint JS debe coincidir con CSS; Button depende de su semántica nativa de submit; el modo oscuro previo tiene especificidad propia.

## Fase 1 entregada

- `adminAppearance.ts`: apariencia solo en producto multiempresa (`VITE_PRODUCT_TENANCY=required`), para roles admin/manager y fuera de POS; preferencia de alto contraste local, tolerante al almacenamiento bloqueado. No decide autorizaciones.
- `adminAppearance.css`: tokens, superficies, cards, botones, campos, tablas, badges, estados vacíos, loading, alertas y diálogos. Reglas dentro de `@media screen` para no cambiar recibos/impresión.
- Acceso flotante a Nexora: superficie sobria y separación del acceso móvil a Mercancía; prueba de cajas delimitadoras para impedir superposición.
- Shell: navegación activa con `aria-current`, menú con `aria-controls`, enlace para saltar al contenido y control de alto contraste con `aria-pressed`.
- Alto contraste operativo: texto/bordes reforzados; disponible desde la barra superior. La preferencia clara/oscura anterior se conserva para caja y otras vistas fuera de alcance.
- Nuevas primitivas aditivas: Field enlaza etiqueta/ayuda/error; TableFrame permite desplazamiento con teclado; Alert combina texto y estado; Card etiqueta secciones.
- Galería de desarrollo `#styles`: ejemplos identificados como ficticios, sin guardar ni llamar APIs. Conserva el bloqueo de la guía en compilaciones de producción.
- Modal: devuelve el foco al control que lo abrió aunque el consumidor no use `Dialog.Trigger`; conserva cierre con Escape, trampa de foco y callbacks existentes.
- Capturas locales con API sintética interceptada y red externa bloqueada. No son datos de una empresa ni evidencia de operación en producción.

## Plan de siguientes fases

| Fase | Entrega | Criterio de aceptación |
|---|---|---|
| 2 · tablero del negocio | Reordenar métricas y excepciones antes del banner; resumen diario con fuentes/período; entrada contextual a Nexora desde tarjetas; alertas inteligentes con estado y enlaces reales | Sin cifras inventadas; errores/carga explícitos; permisos vigentes; una acción primaria; desktop/móvil y teclado |
| 3 · gestión | Catálogo, inventario, clientes, reportes y configuración; formularios y tablas consistentes; migración progresiva a primitivas | Conservar validaciones y acciones existentes, probar cada flujo afectado; alto contraste y 320 px |
| 4 · operadora | Aplicar tokens y jerarquía al panel de plataforma, sus estados y tablas | Mantener separación entre empresa y operadora y las guardas actuales |

La operación Macgen y el acento GV sirven como referencia de jerarquía, no como permiso para incorporar una agenda/cursos ni lógica financiera nueva. La presentación de caja se evalúa en su fase específica. La contraseña web y el PIN de caja siguen siendo flujos diferentes; no se crea recuperación ni autenticación alternativa.

## Validación y autoauditoría

- Chromium local: script `node tests/obsidian-lumina.mjs`, con Vite dev en modo multiempresa (`VITE_PRODUCT_TENANCY=required`) en `127.0.0.1:4264`. Las capturas finales corresponden al modo multiempresa. Control adicional de tienda independiente en puerto 4262 con `LUMINA_LEGACY=1`: mantiene apariencia original y selector claro/oscuro. Endpoint configurable mediante `LUMINA_TEST_URL`, limitado a servidor local; interceptación de API y bloqueo de tráfico externo.
- Regresión contra worktree limpio de `2f147d2`, puerto 4263: FALLA `null !== 'obsidian'` antes de la implementación. El mismo primer control pasa con la fase 1. La ejecución inicial de `pnpm check` encontró una expectativa literal de la ruta antigua de la guía; se actualizó para comprobar las dos galerías dentro de la misma guarda de desarrollo.
- 7 anchos (320, 390, 780, 781, 900, 901, 1440): dashboard y galería sin scroll horizontal del documento; menú móvil inert al cerrar y foco restaurado al salir.
- Diálogo real Radix: tokens heredados, Escape y retorno del foco; etiquetas, ayuda y error enlazados en Field.
- Persistencia tras recarga; modo oscuro previo no derrota los tokens; admin → POS → admin, seller/manager y cierre de sesión sin fuga del atributo de apariencia. El tema del producto no se activa en la modalidad de tienda independiente.
- `prefers-reduced-motion`: spinner sin animación; impresión sin tokens de pantalla.
- Contraste medido con CSS real: texto/superficie 16,52:1; texto secundario/superficie suave 8,30:1; acento textual 7,62:1; error 9,29:1; botón principal 9,99:1. Alto contraste: texto/superficie 19,57:1. No equivale a certificar todas las pantallas heredadas.
- `pnpm check`: salida 0; tipos, lint, 135 archivos de pruebas aprobados/1 omitido; 871 pruebas aprobadas/10 omitidas; build web y API correcto. Advertencia de chunks grandes, sin aumentar límites ni desactivar comprobaciones.
- Smoke sobre build de producción: `LUMINA_PRODUCTION=1 LUMINA_TEST_URL=http://127.0.0.1:4265 node tests/obsidian-lumina.mjs` PASS; no hay botón de galería y `#styles` redirige.
- Contrato de guía de desarrollo actualizado para las dos galerías, manteniendo guardas de navegación y ruta.
- Registro reproducible: `capturas/obsidian-lumina/verificacion.json`.
- Revisión cruzada: corregidos contraste del botón Entrada y campo inválido de Mercancía al heredar tema claro; estas correcciones son de presentación.
- Sin cambios en APIs, base de datos, reglas fiscales, cálculos, pagos, permisos o lógica de sesión. No se probó dinero contra servidor porque no se modificó esa lógica.
- Pendiente: contraste completo de vistas especializadas con colores fijos y gráficos SVG, lector de pantalla manual y validación en hardware real. Se atienden en fases 2–4.

## Capturas

- [Administración desktop](capturas/obsidian-lumina/admin-desktop.png)
- [Administración móvil](capturas/obsidian-lumina/admin-mobile.png)
- [Componentes desktop](capturas/obsidian-lumina/componentes-desktop.png)
- [Componentes móvil](capturas/obsidian-lumina/componentes-mobile.png)
- [Menú móvil](capturas/obsidian-lumina/menu-mobile.png)
- [Diálogo](capturas/obsidian-lumina/dialogo-desktop.png)
- [Alto contraste](capturas/obsidian-lumina/alto-contraste.png)
