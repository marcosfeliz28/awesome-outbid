Base: 1fe0c99968ae9dff5fa91da6248ff787a1543896

# Paso 1 — lista propia a ciegas de ChatGPT nube

Esta lista se preparó antes de abrir o traer `consulta/catalogo-13nov`. Se revisaron la tienda en `nexora-cloud`, el producto en `producto-nexora` y el instalador. Se descartaron las mejoras C1–C16 y D1–D12 ya levantadas.

1. **N-A01 · Entregar una venta preparada de vendedora a cajera.** Una venta «En espera» solo vuelve a la cuenta que la creó; propongo una cola de sucursal que conserve quién preparó y quién cobró, sin compartir usuarios. Evidencia: `apps/api/src/admin.ts:741-745,804-813`. **Versión:** ambas.
2. **N-A02 · Añadir «Saltar al contenido».** Con teclado hay que atravesar menú y barra superior en cada pantalla, aunque el paquete de interfaz ya incluye el primitivo; conectarlo al contenido principal. Evidencia: `apps/web/src/App.tsx:991,1241`; `packages/ui/src/nx-primitivos.tsx:228`. **Versión:** ambas.
3. **N-A03 · Mostrar el atajo correcto para Windows.** La aplicación acepta Ctrl+K y Cmd+K, pero la barra enseña solo `⌘ K`; mostrar la tecla según plataforma o «Ctrl/Cmd + K». Evidencia: `apps/web/src/App.tsx:834-839,1120,1313`. **Versión:** ambas.
4. **N-A04 · Agrupar el menú por trabajo.** La dueña y gerencia reciben una lista plana de casi veinte destinos; propongo grupos: vender/cobrar, inventario/compras, clientes, análisis y administración. Evidencia: `apps/web/src/App.tsx:202-298,1037-1049`; `producto-nexora:apps/web/src/App.tsx:242-337`. **Versión:** ambas.
5. **N-A05 · Unificar la entrada a inventario y abastecimiento.** «Inventario», «Mercancía» y «Compras» reparten tareas relacionadas y obligan a saber dónde empieza cada flujo; una portada común puede enlazar recibir, contar, ajustar, traspasar, ordenar e historial sin cambiar permisos. Evidencia: `docs/sistema/PANTALLAS.md:87-103`; `apps/web/src/Management.tsx:790,1170`. **Versión:** ambas.
6. **N-A06 · Selector real de sucursal.** El producto ofrece planes de varias sucursales, pero el bloque superior con chevrón no es un control; debe mostrar y cambiar el alcance activo con confirmación si hay trabajo en curso. Evidencia: `docs/producto/ARQUITECTURA_NEXORA_PRODUCTO.md:12-16,39-45`; `producto-nexora:apps/web/src/App.tsx:1429-1437`. **Versión:** producto.
7. **N-A07 · Arranque reanudable y verificable.** «Primeros pasos» tiene dos pasos, oculta el fallo al registrar el equipo y deja usuarios e impresión como pendientes; propongo progreso persistente y una comprobación de equipo, caja, usuarios e impresión antes de declarar la tienda lista. Evidencia: `producto-nexora:apps/web/src/Onboarding.tsx:53-54,128-143,196-233`. **Versión:** producto.
8. **N-A08 · Enlaces de puesta en marcha a la tarea exacta.** Logo/RNC, crear cajera y NCF llevan todos a la portada de Configuración; cada tarjeta debe abrir su sección y conservar el progreso al volver. Evidencia: `producto-nexora:apps/web/src/Onboarding.tsx:210-221`; `producto-nexora:apps/web/src/Management.tsx:4234-4242`. **Versión:** producto.
9. **N-A09 · Núcleo compartido y matriz de diferencias entre tienda y producto.** Las ramas tienen cientos de commits exclusivos y los arreglos se trasladan manualmente; propongo módulos comunes por dominio y una lista automática de cambios deliberadamente exclusivos o pendientes de portar. Evidencia: `docs/producto/ARQUITECTURA_NEXORA_PRODUCTO.md:7-10`; `apps/web/src/Management.tsx:244,790,1170,1606,2287,2856,3085,3207`; `git rev-list --left-right --count origin/producto-nexora...origin/nexora-cloud` dio `443 826`. **Versión:** ambas.
10. **N-A10 · Reducir el sondeo de eventos en tiempo real.** Mientras hay una conexión, la API consulta eventos cada 150 ms, incluso sin novedad; usar espera adaptativa o notificación de base reduce consultas ociosas. Evidencia: `apps/api/src/realtime.ts:69-75,120-123`. **Versión:** ambas.
11. **N-A11 · Reutilizar el resumen del tablero.** Al abrir Resumen se piden mes, hoy y ayer, y cada ejecución coordina muchas operaciones de base; propongo una respuesta agregada o reutilización de subresultados. Evidencia: `apps/web/src/Dashboard.tsx:78,110`; `apps/web/src/KpiStrip.tsx:22`; `apps/api/src/reports.ts:339`. **Versión:** ambas.
12. **N-A12 · Paginar e indexar transferencias pendientes.** La pantalla refresca cada 30 segundos una consulta sin límite y el modelo no tiene índice por método/estado; paginar y añadir el índice evita degradación con historial. Evidencia: `apps/web/src/TransferReconciliation.tsx:42`; `apps/api/src/sales.ts:3052`; `apps/api/prisma/schema.prisma:492`. **Versión:** ambas.
13. **N-A13 · Caducidad y limpieza segura de datos offline.** Al cerrar sesión se conserva la venta o mercancía pendiente, incluyendo datos transaccionales, sin una caducidad local visible; propongo vencimiento, inventario de pendientes y borrado seguro tras sincronizar. Evidencia: `apps/web/src/api.ts:50,284-299`; `packages/shared/src/index.ts:550,593`. **Versión:** ambas.
14. **N-A14 · Credencial administrativa inicial de un solo uso.** La instalación silenciosa deja un archivo reutilizable en Documentos y la cuenta creada no exige cambio inmediato; propongo mostrar/entregar la clave una vez y forzar su reemplazo al primer acceso. Evidencia: `instalador/lanzar-instalacion-silenciosa.ps1:183,272`; `apps/api/scripts/create-admin.ts:128`. **Versión:** producto instalado.

## Cruce posterior con el catálogo

| Mía | En el catálogo | Coincidencia |
|---|---|---|
| N-A01 | COM-02 | igual |
| N-A02 | no está | — |
| N-A03 | no está | — |
| N-A04 | DIS-03 | igual |
| N-A05 | no está | — |
| N-A06 | EST-16 | parecida |
| N-A07 | MOD-02 | parecida |
| N-A08 | MOD-02 | parecida |
| N-A09 | EST-01 | parecida |
| N-A10 | EFI-02 | igual |
| N-A11 | EFI-05 | parecida |
| N-A12 | EFI-08 | igual |
| N-A13 | SEG-09 | parecida |
| N-A14 | no está | — |

