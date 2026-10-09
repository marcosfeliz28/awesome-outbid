# Renovación de capturas del manual — v3.6

## Bloqueo constatado

Base inspeccionada: `origin/nexora-cloud`, commit `fc69078`. Tras `git fetch origin`, no existe una referencia publicada `origin/claude/g-ui`; las órdenes v3.6, sección 3e, reservan U1 y su interfaz a Claude y permiten renovar el manual cuando sus cambios estén integrados. No se han generado imágenes que aparenten certificar esa interfaz pendiente.

El manual conserva ocho tareas y siete saltos de página. Las capturas antiguas son de la aplicación React local con datos ficticios, no una maqueta ni producción, pero no verifican la interfaz final. No se reutilizarán como evidencia de U1.

## Renovación cuando se integre la interfaz

1. Ejecutar `git fetch origin`, incorporar la base autorizada y registrar su SHA exacto. No traer ramas reservadas por iniciativa propia.
2. Instalar dependencias con el lockfile congelado, sin copiar `.env`, cuentas reales ni credenciales. Compilar la web y servirla únicamente en localhost, puerto **4264**.
3. Adaptar `scripts/capture-cashier-manual.mjs` para usar ese puerto y los contratos actuales. Interceptar todas las rutas API con fixtures sintéticas y bloquear servicios externos; nunca conectarlo a Render.
4. Mostrar una identificación «Datos ficticios · práctica local» en las imágenes. Registrar rol, ruta y estado reproducido; distinguir cajera, gerente con `sale:manage` y administrador con `*`.
5. Capturar cada formulario después de comprobar que está visible; inspeccionar visualmente todas las imágenes. No afirmar que una petición simulada demuestra controles del servidor.
6. Repetir al menos en 390 px para detectar recortes; verificar que los pasos del manual describen los nombres visibles actuales.

## Ocho tareas que deben documentarse

| Tarea | Evidencia necesaria |
|---|---|
| Abrir caja | Fondo inicial y aprobación cuando corresponda; rol cajera |
| Preparar venta | Búsqueda, carrito y creación/selección de cliente |
| Cobrar y autorizar | Pago normal, crédito/contraentrega y descuento con PIN, sin revelar uno real |
| Retirar efectivo | Salida con motivo y autorización por acumulado del turno |
| Devolver | Formulario de persona autorizada, caja propia abierta; no solo la lista de ventas |
| Anular | Administrador: cubrir caja original abierta; original cerrada sin efectivo; original cerrada con efectivo sin caja propia (rechazo), con caja propia sin saldo (rechazo), y con efectivo suficiente |
| Cerrar caja | Conteo ciego, tarjeta/transferencia vacías = 0 y confirmación obligatoria |
| Sin internet | Pendientes/revisión y aviso de no repetir cobros |

La fuente de autorización y dinero es el servidor: `sales.ts`, `voidSale`, exige `*` y motivo; si `originalCash?.closedAt && cashCollected(saleRef.payments) > 0`, exige caja abierta propia y efectivo suficiente. `returnSale` exige `sale:manage` y una caja abierta mediante `cashLock`. Una pantalla que no pida caja antes de enviar no elimina estos controles. Véase [VERIFICACION_MANUAL.md](VERIFICACION_MANUAL.md).

No hay despliegue, cambios en archivos de interfaz reservados ni nuevas capturas en esta preparación.
