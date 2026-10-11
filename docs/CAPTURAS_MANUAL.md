# Capturas del manual — interfaz wave3, práctica local

## Base y alcance

Renovadas el **10 de octubre de 2026**. Base documental: `7dc49ef`. Se utilizó la compilación web local de `92853bb31870e9769cab13f1d22ac1fcf68d146d`; `git diff --quiet 92853bb 7dc49ef -- apps/web packages/shared` terminó con código 0: ambos árboles de interfaz y contratos compartidos coinciden. SHA-256 de su `index.html`: `E2A1FDA48806EEAAF8D13A484D616817D649F5CC607C47F4E3394D3DF484CC77`.

Son capturas de la aplicación React compilada, no maquetas. **Datos ficticios · práctica local** aparece en cada imagen. No se usaron cuentas, inventario, credenciales ni servicios de producción; las respuestas API son fixtures sintéticas. Ver un botón con un rol ficticio **no prueba autorización del servidor**. No se ejecutaron cobros, retiros, devoluciones, anulaciones ni cierres reales. Tampoco se certifica impresión física, despliegue o disponibilidad de la nube.

El manual conserva ocho tareas y siete separadores de página; no se ha renderizado un PDF para certificar ocho páginas físicas.

## Método realizado

1. Copiar la compilación local existente a un directorio temporal ignorado y servirla únicamente en `http://127.0.0.1:4264`.
2. Playwright/Chromium abre contextos aislados de cajera, gerente y administrador, a 1024 y 390 px. Intercepta todas las solicitudes `/api/` con datos sintéticos y bloquea cualquier solicitud a otro origen. Los service workers están bloqueados.
3. Abrir los formularios reales mediante sus botones, sin confirmar operaciones. Los campos PIN permanecen vacíos. Para el caso sin internet, poner el contexto realmente offline e insertar únicamente dos registros ficticios en su IndexedDB aislado: Pendiente y Requiere revisión.
4. Capturar las pantallas completas, añadir únicamente la identificación de práctica y cerrar navegador y servidor local. No se alteró la lógica ni el diseño de la app.
5. Inspeccionar visualmente las **22 imágenes** resultantes; conservar originales de ambos anchos y una selección de escritorio con los nombres usados por el manual. [manifest.json](capturas/manual/manifest.json) registra archivo, rol, ancho, ruta y base de cada original.

La ejecución local fue `node outputs/capture-local.mjs` (salida 0); su fuente se conserva en [generar-local.mjs](capturas/manual/generar-local.mjs). Es una receta de captura, no una suite de autorización. Para repetir desde la raíz del repositorio con dependencias y navegador Playwright instalados: compilar la web y ejecutar `node docs/capturas/manual/generar-local.mjs`. Regenera archivos de este directorio; revisar y actualizar la base registrada cuando cambie la interfaz. No iniciar la API ni copiar un `.env` de producción.

## Selección y variantes

Los nombres sin ancho son la selección de escritorio del manual. Cada estado dispone además de originales `-1024.png` y `-390.png`.

| Tarea              | Archivo seleccionado        | Rol y estado visible                                                                                                                          |
| ------------------ | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Abrir caja         | `01-abrir-caja.png`         | Cajera; fondo inicial, sin guardar                                                                                                            |
| Preparar venta     | `02-vender.png`             | Cajera; producto y cliente ficticios en el carrito                                                                                            |
| Cobrar y autorizar | `03-credito.png`            | Cajera; crédito/contraentrega y PIN vacío; `03-cobrar.png` muestra efectivo antes de agregarlo                                                |
| Retirar efectivo   | `04-retiro.png`             | Cajera; salida, motivo y PIN vacío, sin guardar                                                                                               |
| Devolver           | `05-devolucion-gerente.png` | Gerente; artículo, cantidad, estado y reembolso, sin guardar; `05-ventas.png` es la consulta de cajera                                        |
| Anular             | `06-anulacion-admin.png`    | Administrador; motivo y explicación de caja propia, sin confirmar                                                                             |
| Cerrar caja        | `07-cierre-ciego.png`       | Cajera; denominaciones, declaraciones vacías y confirmación sin marcar; `07-confirmacion-cierre-390.png` muestra la parte inferior desplazada |
| Sin internet       | `08-sin-internet.png`       | Cajera offline; Pendiente, Requiere revisión y acciones visibles en escritorio                                                                |

## Revisión visual y límites de celular

En 1024 px los formularios seleccionados son legibles. En 390 px las tablas de ventas y pendientes necesitan desplazamiento horizontal para ver sus acciones, y los formularios largos de crédito/cierre requieren desplazamiento vertical. La captura inferior del cierre muestra un **recorte horizontal del texto del botón «Cerrar caja e imprimir cuadre»** y un leve recorte de Cancelar. Se conserva la imagen como evidencia del comportamiento actual; no se corrigió ni retocó la interfaz para ocultarlo. No afirmar una revisión móvil sin limitaciones.

## Cierre ciego: pantalla frente a servidor

La pantalla anuncia comparación después de cerrar (`apps/web/src/Management.tsx:1620`). El cierre solicita luego el cuadre (`apps/web/src/Tienda.tsx:194`). Sin embargo, `apps/api/src/cash.ts:1151` filtra líneas cuyo nombre empieza por `difference` y elimina el resumen para quien no puede ver esperados. Las capturas no ejercitan esta respuesta real: el manual indica conservar el cuadre y pedir revisión a gerencia, **sin prometer qué diferencias verá la cajera**. No copiar esperados al declarar, ni considerar un formulario vacío un cierre realizado.

## Casos todavía sin captura y pendientes de prueba real

- Apertura con fondo inferior al sugerido; creación de cliente; descuento que solicite PIN; validación correcta/incorrecta del PIN.
- Anulación: caja original abierta; original cerrada sin efectivo; original cerrada con efectivo sin caja propia (rechazo), **con caja propia sin saldo (rechazo)** y con efectivo suficiente. La explicación visible no demuestra que estos controles se ejecutaron. Devolución sin caja abierta y sus rechazos reales.
- Offline: cambio de precio, caducidad, confirmación de descarte con motivo/PIN, cierre bloqueado por pendientes y recuperación del carrito tras inactividad. Las filas mostradas fueron insertadas como fixtures, no creadas por ventas reales.
- Cuadre posterior al cierre por rol y diferencias visibles; impresión térmica física. La revisión de código anterior, con su base propia, permanece en [VERIFICACION_MANUAL.md](VERIFICACION_MANUAL.md).

Estos pendientes no se presentan como capturados ni aprobados. La renovación documenta la UI local integrada; no constituye una aprobación de producción.
