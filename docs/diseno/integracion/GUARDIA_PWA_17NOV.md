# Guardia PWA: no forzar la actualización durante trabajo activo

Base 59d77a17. Rama aislada, sin despliegue ni cambios en pagos/API/turnos.

Se elimina la recarga incondicional del listener temporal. Workbox recibe false para no recargar por su cuenta. El listener único controllerchange revalida carrito, diálogo de pago/conteo y edición reciente, incluso si otra pestaña activó el service worker. Botón manual y actualización eager usan la misma barrera. Ninguna ruta de actualización guarda, vacía ni modifica el carrito.

Política conservadora: no se implementa recarga con carrito activo. IndexedDB puede fallar; la persistencia durable no está garantizada por cartDraft.write, así que no se usa como justificación para forzar una recarga. El pago está protegido por carrito/modal; no se modifica su código ni su UUID. No se cierra ni reabre el turno.

Pruebas ejecutan módulo real pwaUpdate con SW/DOM simulados: escaneo entre apply/controllerchange, activación en otra pestaña, pago/conteo con carrito vacío, formulario reciente y eventos repetidos. Antes: 3 fallos / 2 pasos. Después: 5/5; total con políticas/carrito21/21. ESLint focal pasa. No equivalen a prueba SW en navegador real ni a CI de commit final.

Pendientes antes de producción: verificar SW real y doble pestaña en copia aislada, turno idéntico antes/después, envío incierto/offline e IndexedDB fallando sin recarga; capturas exactas y aceptación de Marcos; tres CI verdes del SHA final integrado. No prometer actualización sin pérdidas con una venta activa. Publicar web no exige forzar a cajeras a F5.
