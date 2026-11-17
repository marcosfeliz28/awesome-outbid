# Preflight aislado Inicio + Punto de venta

## Identidad
- Diseño con CI verde: `59d77a175da32e3f383321233e10d9f0edf618b6`.
- Base tienda observada: `a732e1f22545bfd78483c25f4580977c42a4105b`.
- Inicio canónico `0641409cc82f81df01337a72cded4061f1f560a5` ya está incorporado por contenido. App, Dashboard, QuickAccessOverview, KpiStrip son idénticos en los dos commits. No aplicar Inicio de nuevo.
- Merge aislado sin conflictos. Conserva diez fotos nuevas de base y la auditoría de Claude. Respecto a 59d77a17 no cambia código, pruebas, configuración ni lógica: solo diez WebP y dos documentos.
- No se ha cambiado producción ni Render. No se ha publicado esta integración.

## Verificación
31/31 pruebas focales pasan en el árbol de código exacto 59d77a17, idéntico al de esta integración: pwa-update (6), cart-draft-policy (7), cart-draft-race (3), caja-presentacion (3), inicio-integrado (12). No equivale a los tres controles CI del nuevo merge, que deben repetirse sobre su SHA final. No se han hecho nuevas capturas aquí.

## Actualización segura
La PWA ya espera con carrito lleno, evita formularios/diálogos en actualización automática, conserva borrador por usuario en IndexedDB y reutiliza offlineUuid. Turnos se consultan al servidor: este diseño no los abre/cierra ni cambia sus identificadores.

Limitaciones preexistentes comprobadas en código:
- cartDraft.write captura los errores de IndexedDB; no es confirmación durable ni flush estricto. No prometer recargar con carrito activo sin pérdidas.
- apply comprueba carrito al iniciar, pero su controllerchange recarga sin revalidar. Puede existir carrera si se escanea durante activación. Actualización manual no comprueba diálogo; la automática eager tampoco verifica tiempo desde último input.
- Pruebas PWA actuales mezclan política pura con comprobaciones textuales; no prueban todas esas carreras en navegador.

## Puerta de publicación
1. Publicar solo rama aislada y correr verify, windows-installer, render-images contra SHA final. Mantener las fotos de base; no reemplazar la tienda por un snapshot viejo.
2. Capturas reales 1440/390 claro/oscuro del SHA exacto y aceptación visual de Marcos, como exige la auditoría de Claude.
3. Antes de activar versión: terminar la venta, confirmar respuesta/recibo, carrito vacío, ningún cobro incierto, diálogo o conteo de cierre abierto; verificar pendientes offline y las demás pestañas/equipos. No forzar F5, logout, borrar cache ni cerrar turno para actualizar.
4. Registrar turno/usuario/sucursal activos antes y confirmar iguales después. Prueba aislada: carrito, intento de cobro/reintento offlineUuid, pestaña múltiple, fallo IndexedDB, escaneo durante controllerchange.
5. Si se requiere actualizar durante venta activa, antes debe implementarse y probarse un guardado durable más barrera de pago/identidad y revalidación justo antes de recargar. No está implementado aquí.
6. Guardar SHA web desplegado anterior para reversión solo web; nunca restaurar base ni revertir ventas como rollback visual.

No se afirma instalación, despliegue ni riesgo cero.
