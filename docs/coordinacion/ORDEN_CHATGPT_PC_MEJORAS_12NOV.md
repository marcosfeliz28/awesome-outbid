# Orden para ChatGPT PC — mejoras de uso e IA (12-nov-2026, Norexos 1)

Orden de la dueña (11-nov): repartir el trabajo de mejoras entre todos los agentes. Marco: `REPARTO_MEJORAS_12NOV.md`. Lista y razones: `LEVANTAMIENTO_MEJORAS_IA_12NOV.md`. Tu parte es **comprobar en pantallas reales y en Windows**; no cambias código de la aplicación.

## Reglas fijas
- Solo código de prueba, documentos, CI y bases descartables (usa la copia de prueba de `COPIA_PRUEBA_PARA_CHATGPT_DEEPSEEK_10NOV.md` o datos de demostración). Sin producción, Render, base de la tienda, credenciales ni claves.
- No mezclas ni despliegas. Una rama tuya por pieza: `chatgpt-pc/<pieza>`. Un solo push al terminar.
- No cambias `apps/**` ni `tests/e2e/**` (son de Claude nube): lo que encuentres va en el informe, con captura.
- **Al terminar cada prueba cierra los navegadores y procesos que abriste** (Playwright, node, PostgreSQL de prueba): la PC de la dueña ya se quedó sin memoria por esto.
- Cita archivo:línea cuando haya código y di lo que NO pudiste comprobar.
- Reporta en `docs/coordinacion/RESULTADOS_CHATGPT.md` (pieza, rama, SHA, comando, resultado). Una pieza bloqueada se anota BLOQUEADA y sigues con la siguiente.

## Pieza 1 — línea base de pantallas ANTES de las mejoras
Sin esta base no se puede probar que una mejora ayudó. Rama `chatgpt-pc/linea-base-12nov`.
1. Sobre `origin/nexora-cloud`, con datos de prueba, a **1366 px y 390 px**, con los roles cajera, gerente y dueña, captura el estado actual de estas pantallas y situaciones:
   - **Punto de venta sin cliente:** pulsa F12 con el carrito lleno y sin cliente; anota cuántos pasos hasta cobrar (C1).
   - **Descuento:** el campo de descuento de una línea, antes y después de pasar el 10 % (C13).
   - **Existencia baja:** un producto con 1 unidad; agrega 2 y copia el mensaje exacto (C15).
   - **Solicitudes de anulación** como cajera: cómo se muestra el método de pago (C6). **Ventas** como cajera (C9, C12).
   - **Títulos y subtítulos** de Ventas, Caja, Clientes, Resumen y del aviso al terminar una venta (C12).
   - **Configuración › Usuarios y Roles y Bitácora**, como dueña: permisos y acciones tal como se ven hoy (D5).
   - **Configuración › Uso de IA** (D11) y el menú «Preguntar a Norexos» (aparece solo si la IA está encendida; si no aparece, anótalo).
2. Salida: `docs/validacion/LINEA_BASE_MEJORAS_12NOV.md` (qué se ve, qué molesta, qué mide cada paso) y las capturas en `docs/validacion/capturas-12nov/` con nombres `<codigo>-<pantalla>-<ancho>.png`. Nada de datos personales de clientes reales en las capturas.

## Pieza 2 — escáner de cámara en una webcam real (C14)
Hoy el escáner de cámara del punto de venta se cierra después de cada código (`POS.tsx` cerca de la línea 1582). Con una webcam de Windows y 3 productos con código, escanéalos seguidos y anota: cuántos pasos entre un código y el siguiente, qué mensaje sale, si el sonido avisa. Añade el resultado a `LINEA_BASE_MEJORAS_12NOV.md`. Si no hay webcam disponible, di BLOQUEADA y por qué.

## Pieza 3 — validar cada fase ya desplegada
Cuando Norexos 1 avise «Fase N desplegada»: repite la pieza 1 sobre la versión nueva y entrega `docs/validacion/RECORRIDO_MEJORAS_<fase>.md`: por cada código, captura antes y después, si se logró lo prometido (ver la columna de criterios en `ESTADO_MEJORAS_12NOV.md`), y todo lo que se vea cortado, lento o confuso. No arregles nada de dinero tú.

## Pieza 4 — instalador con la fase nueva
Después de cada fase: compilar (`pnpm instalador:compilar`), instalar en Windows limpio o máquina virtual, entrar, vender, cerrar caja, respaldar y restaurar. Registra versión, tamaño y SHA-256 en `docs/validacion/instalador-<fecha>.md` con la lista exacta de lo que falló.

## Te toca revisar cada hora
`git fetch`; relee este archivo, `REPARTO_MEJORAS_12NOV.md` y `ESTADO_MEJORAS_12NOV.md`, y sigue con la siguiente pieza sin esperar.
