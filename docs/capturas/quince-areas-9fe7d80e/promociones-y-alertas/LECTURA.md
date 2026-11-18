# Promociones y Alertas · 9fe7d80e

Código examinado `9fe7d80ee3eb8aeef4264059d98809e80943e741`; API, PostgreSQL y web locales con seed ficticio, sin guardar promociones ni modificar alertas. Edge 1440 × 900 y 390 × 844, temas claro/oscuro, ES, movimiento reducido. Se bloquearon solicitudes externas y escrituras operativas; no se registraron errores JS ni desborde horizontal global. Servicios propios cerrados.

## Promociones

El endpoint real de candidatos devolvió 86 registros demo y aparecieron 86 tarjetas en ambos tamaños. Las pestañas «Candidatos a liquidación» y «Mis promociones» respondieron. Para probar el fallback se cambió solamente en el DOM de la primera imagen su `src` a una ruta inexistente: el manejador mostró `/products/accessories.svg` y la imagen cargó. No se probó una foto comercial ni un dato defectuoso persistido en servidor; no se creó ni activó promoción.

## Alertas

El endpoint real devolvió 128 alertas demo. Las pestañas Nuevas, Vistas, Resueltas y Todas respondieron; seleccionar la primera actualizó el encabezado del detalle con el mismo texto sin modificar el estado de la alerta. En escritorio el detalle comenzó a 368 px de la parte superior y quedó visible; en móvil, con 128 registros y sin desplazamiento automático, quedó 32.847 px bajo el primer viewport. El registro seleccionado y su detalle coinciden. En móvil hace falta un acceso visible al detalle desde la lista.

En la primera insignia «Atención» se midió color/fondo sólido: modo claro `rgb(146,64,14)` / `rgb(255,245,230)` = 6,57:1; oscuro `rgb(251,191,36)` / `rgb(64,43,23)` = 7,98:1. Esta muestra supera 4,5:1; no certifica otros textos, estados o gradientes. Las capturas muestran el área visible del navegador.

## Inventario

Sin repetir el recorrido completo, los paneles de alertas/movimientos permanecen a 2.317 px bajo el primer viewport de 1440 y 10.284/11.301 px en 390, igual que en la medición anterior de `ce128988` con el mismo seed. No se comprobó un atajo alternativo.

Las métricas y rutas de capturas están en `comprobacion-integrada.json`. No se probó lector de pantalla, todos los controles ni los controles automáticos, que se documentan en [CI](../CI.md).
