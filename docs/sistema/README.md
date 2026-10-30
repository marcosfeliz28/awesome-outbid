# Base del sistema: qué es y cómo se usa

Levantamiento hecho el 30-oct-2026 sobre la rama `cola-n26` (igual a `origin/nexora-cloud`, la tienda en vivo). Todo dato lleva cita `archivo:línea` de ESTA rama. Si no se pudo confirmar, dice «NO ENCONTRADO» o «DUDOSO». Sin credenciales.

## 1. Qué es

- Es un punto de venta (POS) con inventario, caja, compras, reportes y un módulo de cursos y citas (GV). Lo usa **Grupo MacGen** (suplementos, fajas, tenis y ropa deportiva, accesorios de gym, maquillaje) y su empresa hermana **GV Makeup Studio** (cursos, servicios, productos). Fuente: `apps/web/src/App.tsx:284-312` (caras del cubo de entrada) y `apps/web/src/App.tsx:349` («GRUPO MACGEN · GV MAKEUP STUDIO»).
- **Nombre del producto.** **Norexos** es la marca nueva del producto; el cambio de nombre en el código es la etapa E1 del plan maestro (rama `marca/cambio-nombre`, 30-oct a 5-nov) (`docs/proyecto/PLAN_MAESTRO_NOREXOS.md:11`, `:11`). **Hoy, en esta rama, el nombre visible sigue siendo «Nexora POS»**: pie de página `apps/web/src/App.tsx:1199`, ventana «Acerca de Nexora POS» `apps/web/src/App.tsx:154`, recibo `apps/web/src/POS.tsx:2341`. La palabra «Norexos» NO ENCONTRADO en `apps/web/src` ni `apps/api/src`. Al documentar pantallas se usa el texto que sale hoy («Nexora POS»).
- Moneda RD$, zona horaria `America/Santo_Domingo` (`packages/shared/src/index.ts:803`), ITBIS 18 % por defecto (`apps/api/prisma/schema.prisma:104`, campo `taxRate`).
- Los recibos son **documento no fiscal**: «DOCUMENTO NO FISCAL – NO ES COMPROBANTE FISCAL» (`apps/web/src/Prints.tsx:509-510`). El sistema no emite NCF/e-CF (`apps/web/src/Prints.tsx:508`); solo «prepara la solicitud» si se activa en Configuración (`apps/web/src/Management.tsx:4132-4140`).
- Stack: web React (`apps/web`), API NestJS (`apps/api`), PostgreSQL con Prisma (`apps/api/prisma/schema.prisma`), paquete compartido con reglas de dinero (`packages/shared/src/index.ts`).

## 2. Mapa de esta base (`docs/sistema/`)

| Archivo | Para qué sirve |
|---|---|
| `README.md` | Este mapa, reglas de dinero, ramas y quién despliega. |
| `PANTALLAS.md` | Cada pantalla del menú: etiqueta exacta, permiso, componente, qué hace. |
| `FLUJO_CAJA_POS.md` | Paso a paso del cajero, de abrir caja a cerrar. |
| `FLUJO_COBROS_Y_TRANSFERENCIAS.md` | Crédito, contraentrega, abonos, verificación de transferencias, correcciones admin. |
| `FLUJO_MERCANCIA.md` | Entradas, salidas, traspasos Casa↔Tienda, ajustes, conteos, facturas de proveedor. |
| `GV.md` | GV Makeup Studio: cursos, inscripciones, citas, interesadas, pagos. |
| `ROLES_Y_PERMISOS.md` | Roles, permisos, PIN de gerente, qué es solo admin. |
| `DATOS_Y_MODELOS.md` | Tablas principales y estados. |
| `GLOSARIO.md` | Términos del negocio. |
| `RESPUESTAS_A_TALLER.md` | Respuestas con cita a las preguntas de Taller. |
| `CAMBIOS.md` | Bitácora de cambios de esta base. |
| `INDICE.json` | Lista de archivos con resumen, para búsqueda. |

## 3. Cómo leer esta base

1. `grep -rni "<tema>" docs/sistema` antes de preguntarle algo a la dueña (regla del skill `.claude/skills/base-sistema/SKILL.md`).
2. Si no está, léelo en el código y cita `archivo:línea`; luego **agrégalo aquí** en el mismo cambio y anótalo en `CAMBIOS.md`.
3. Las citas son de `cola-n26`. Si el archivo cambió, el número de línea puede correrse unas líneas: busca por el texto de la etiqueta.
4. Lo que existe solo en otra rama va marcado con la rama y «aún no desplegado» o «solo producto-nexora».
5. Preguntas que solo decide la dueña (dominios, correos, precios, montos, conteos): sí se le preguntan.

## 4. Reglas de dinero (no cambian)

| Regla | Dónde está en el código |
|---|---|
| **Margen = (precio − costo) / precio × 100, sin restar ITBIS**, con el precio tal como se cobra. «La única fórmula del sistema». | `packages/shared/src/index.ts:483-486` (`margin`) |
| **Margen mínimo 15 %**. Es el valor por defecto de «Margen bajo» (`lowMargin`); la caja avisa «Esta venta queda con margen X %. El aviso es informativo» (no bloquea); las alertas y el descuento seguro usan el mismo 15. | `apps/web/src/POS.tsx:1915-1919`; `apps/api/src/alerts.ts:507` y `:539` (descuento seguro); `packages/shared/src/index.ts:531-533` (`safeDiscount`); `apps/api/prisma/seed.ts:548` |
| **La caja aplica el descuento de las ofertas.** El carrito toma el mayor entre el descuento manual de la línea y el de las promociones activas; el servidor repite el cálculo y rechaza si el total difiere. El precio del producto en el sistema no se toca. | `apps/web/src/POS.tsx:298-303` y `:340-353`; `apps/api/src/sales.ts:978-984` y `:972-977` («Los precios o promociones cambiaron») |
| **No cambiar precios en el sistema por una oferta.** Para una oferta se crea una Promoción (pantalla «Promociones»), no se edita el precio de la variante. | Regla de la dueña (`CLAUDE.md`, punto 3). Promociones: `apps/web/src/Management.tsx:2431-2475` |
| No tocar lo que la dueña contó o modificó ayer u hoy sin un conteo nuevo suyo. | `CLAUDE.md` punto 3 y `.claude/skills/mercancia/SKILL.md:34` |
| Todo cambio de mercancía (suplementos, maquillaje, fajas) se verifica **3 veces** antes y después; los conteos contra el sistema, **4 veces**; se muestra a la dueña y solo se aplica con su confirmación. | `CLAUDE.md` punto 6; `.claude/skills/mercancia/SKILL.md:12-24` |
| Un descuento exige motivo (mínimo 3 letras) y queda en la auditoría de la venta. | `apps/web/src/POS.tsx:2908-2921`; `apps/api/src/sales.ts:781` |
| Una venta con total RD$ 0 no se registra. | `apps/api/src/sales.ts:987-989` |

DUDOSO (no inventar): el mínimo de 15 % no bloquea la venta ni el cambio de precio en el código leído; solo avisa y genera alertas. Si la dueña quiere que bloquee, es un cambio de código.

## 5. Ramas y quién despliega

| Rama | Qué es |
|---|---|
| `nexora-cloud` | **La tienda en vivo** de Grupo MacGen. Esta base documenta esta rama (`cola-n26` es su copia de trabajo). |
| `producto-nexora` | **El producto multiempresa**. Tiene pantallas que la tienda no tiene («Primeros pasos», «Plan y facturación») y no tiene el módulo GV en el menú. Nunca se mezcla hacia `nexora-cloud` (`docs/coordinacion/INSTRUCCIONES_ACTUALES.md:461`). |
| `claude/ajustes-cobros` | Herramientas admin de cobros en cajas cerradas. **Aún no desplegado.** Ver `FLUJO_COBROS_Y_TRANSFERENCIAS.md`. |

- **Despliega solo Claude (nube)** en Render, con los **3 CI en verde**: `verify`, `windows-installer`, `render-images` (`.github/workflows/ci.yml:20`, `:90`, `:106`). Regla en `CLAUDE.md` punto 4; el auto-deploy está apagado (`render.yaml:21` y `:48`, `autoDeployTrigger: off`). Servicios: `nexora-pos-web` y `nexora-pos-api` (`render.yaml:13`, `:39`).
- Otras sesiones (Taller, Mercancía, Claude PC, modelo local) no despliegan ni tocan Render.
- La tienda solo se despliega **con las cajas cerradas y el OK de la dueña** (`.claude/skills/comunicacion/SKILL.md`, órdenes del 29-oct, sección «CI y publicación»). Una prueba que falla no es «flaky» hasta tener la causa.

## 6. Cosas que conviene saber antes de preguntar

- Para entrar al sistema como Claude: `docs/coordinacion/claude-nube/entrar.py` (lee las credenciales del entorno; nunca se imprimen).
- El menú que ve cada persona depende de sus permisos (`apps/web/src/App.tsx:653-655`). Ver `ROLES_Y_PERMISOS.md`.
- Un equipo nuevo debe ser aprobado por un gerente antes de vender o mover mercancía (`apps/web/src/realtime.tsx:513-516`).
- Atajos de teclado en la caja: F2 buscar, F4 cliente, F8 en espera, F12 cobrar, Ctrl+K cambiar pantalla (`apps/web/src/App.tsx:1236-1260`).
