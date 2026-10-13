# Camino A · Nexora POS Local para uso propio

**13 de octubre de 2026 · Informe para la dueña · decisión previa al código**

## Qué se entregaría

Una instalación independiente en una PC Windows 11 de la tienda: PostgreSQL, API y web locales, servicios que arrancan con Windows, acceso directo y una **ventana propia**. La caja de esa PC podrá vender sin Internet. Otras cajas y celulares podrán entrar por la red local mientras estén encendidos el router y la PC servidora. Si la servidora se apaga, esas cajas dejan de operar contra la base compartida; no se debe prometer sincronización automática entre bases distintas.

El [instalador actual](../INSTALADOR.md) ya incluye instalador, acceso directo, servicios automáticos, PostgreSQL local, HTTPS para celulares, copia diaria de 30 días y una herramienta de restauración desde el menú Inicio. **Aún abre en navegador**; la base de Tauri existe pero no está construida ni probada. El botón «Restaurar copia» dentro de la aplicación sería una interfaz nueva y peligrosa: debe pedir confirmación, cerrar sesiones y conservar un respaldo previo; inicialmente conviene usar la herramienta existente del menú Inicio hasta que una restauración segura desde la ventana supere las mismas pruebas. La prueba completa `Windows-Smoke` en una Windows 11 limpia sigue pendiente.

## Datos y cambio de sistema

La instalación local nace vacía y **jamás se conecta directamente a la base de producción de Render**. Para pasar de nube a local: fijar una hora de corte, cerrar cajas y cola de ventas sin conexión, generar un respaldo cifrado y verificable mediante un procedimiento autorizado por la dueña, restaurarlo en una PC aislada con la misma versión de esquema y comparar variantes, existencias por almacén, ventas, pagos, saldos y costo total. Si falla una comparación, se vuelve a la nube sin abrir ventas locales. Un Excel de inventario sirve para inventario; no reconstruye correctamente historial de ventas y auditoría.

Para volver a la nube: detener ventas en local, respaldar y verificar, restaurar **primero en un entorno nuevo de prueba**, comparar los mismos saldos y hacer el corte después de resolver duplicados y ventas pendientes. La copia local y la nube no deben aceptar ventas al mismo tiempo sin una sincronización diseñada y probada. No hay hoy una migración bidireccional automática demostrada.

## Actualización, respaldo y costo

Antes de cada actualización: respaldo local privado y copia externa comprobada, prueba del archivo y su SHA-256, cierre de cajas, migraciones `prisma migrate deploy`, comprobación de salud y de saldos. Si falla, usar la recuperación documentada en el instalador; no cambiar el esquema de producción. Probar una restauración periódica en otra PC evita descubrir tarde que las copias no sirven.

No hay tarifa mensual de Render para este producto. El costo directo es la PC/Windows, electricidad, un disco o nube para la copia externa, soporte y eventual mantenimiento. **No hay cotización de hardware ni de soporte**; no conviene asignar una cifra ficticia. La PC servidora, el router y la copia externa son puntos críticos. El instalador actual guarda por defecto la copia en la misma PC: la protección contra robo o avería exige una segunda copia verificada fuera de ella.

## Prueba de aceptación previa al uso

ChatGPT PC debe instalar en una Windows 11 limpia, crear dueño sin clave de demostración, abrir la ventana propia, vender y cerrar caja sin Internet, entrar desde otra PC/celular por LAN, apagar y reiniciar la servidora, comprobar la copia diaria, restaurar en base descartable y actualizar con copia previa. Debe guardar capturas, conteos y resultado de `Windows-Smoke`. **Estado hoy:** diseño escrito; ventana propia, migración y botón de restauración dentro de la app pendientes; sin prueba de Windows limpia. La dueña decide cuándo autorizar el código del Camino A.

**Fuentes del proyecto, consultadas el 13-oct-2026:** [instalador](../INSTALADOR.md), [`apps/web/src-tauri/`](../../apps/web/src-tauri/), [`instalador/`](../../instalador/) y [orden 3ad](../coordinacion/INSTRUCCIONES_ACTUALES.md). Este informe no modifica la tienda en Render.
