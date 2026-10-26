# Prueba del producto como persona real · Claude PC · 26-oct-2026

> **Alcance real (importante):** NO se probó `https://nexorapos.net` con sesión. La regla de la sesión prohíbe escribir contraseñas o crear cuentas en producción. Todo se hizo sobre una **copia local en modo PRODUCTO multiempresa** del commit `8ae06d8d` (PostgreSQL embebido desechable, API y web propias, correo simulado), a 1366×768 y 390×844. En el sitio en vivo solo miré la página pública de entrada (sin iniciar sesión). El registro público estaba habilitado en la copia local; en vivo es por invitación, así que **el flujo por invitación del operador no se probó**. «Tiempos» y «clics» son de un script, no de una persona.
> Capturas (en esta PC, no versionadas): `C:\Users\marco\AppData\Local\Temp\cola2\a\a-<paso>-<desktop|mobile>.png`.

## Parte A · Dueña nueva: registro, 2 pantallas, primera venta, «Hoy»

Recorrido completo en ambos tamaños: registro, correo, términos, 2 pantallas de «Primeros pasos», 3 productos, venta en efectivo de RD$ 115, ticket, Resumen y reporte de utilidad. Sin errores 5xx ni scroll horizontal de página.

| id | pantalla | qué pasó | grav. | captura | repetir |
|---|---|---|---|---|---|
| A1 | Reportes › Utilidad por producto | **No cuadra con el Resumen.** Ventas 33.90/42.37/21.19 (sin ITBIS), utilidad 8.90/12.37/21.19 = 42.46. El Resumen da «Ganancia bruta» RD$ 60.00 (115−55, sin restar ITBIS). El Margen (37.5/40/100 %) es (precio−costo)/precio **con** ITBIS; 8.90/33.90 no da 37.5 %. Hay dos fórmulas. | **alta** | `a-4-utilidad-por-producto-desktop` | Vender Agua 25 (costo 0), Refresco 50 (30), Galletas 40 (25); Reportes › Margen |
| A2 | Primeros pasos, paso 2 | El producto no pide costo y queda en 0: margen 100 %. No probé si «Editar precio» edita costo. | media | `a-2-wizard-paso2-lleno-desktop` | Crear producto desde el paso 2 |
| A3 | Resumen | Muestra RD$ 60 de ganancia bruta (coincide con el cálculo a mano, 52.2 %) pero no el % de margen. | media | `a-4-resumen-hoy-desktop` | — |
| A4 | Registro | Casillas de términos y privacidad enormes (44×406 px), centradas, con el texto debajo. | media | `a-1-registro-lleno-desktop`/`-mobile` | `/registro` |
| A5 | Registro | Etiquetas 11 px, ayudas 9 px; enlaces de 14–16 px de alto. | media | `a-1-registro-vacio-desktop` | `/registro` |
| A6 | Registro tras enviar | El formulario no cambia: «Cuenta creada. Confirma tu correo…» sale en gris pequeño entre casillas y botón; «Crear empresa» sigue activo (riesgo de doble envío). | media | `a-1-registro-enviado-desktop` | Enviar registro |
| A7 | Resumen, primer día | Alerta «Necesita atención»: la dueña «entró desde un equipo no aprobado… cambia tu contraseña» por su propio primer acceso. | media | `a-4-resumen-hoy-desktop` | Primer inicio de sesión |
| A8 | Segundo equipo | Al iniciar sesión en otro navegador/teléfono el equipo queda pendiente; el paso 2 da 403 en `/api/inventory/adjustments` y un banner de plan Autoservicio. | media | reproducible (no copiada) | Registrar en un navegador, entrar en otro |
| A9 | Nuevo producto / detalle | Relleno de ropa: marca «Nexora», foto `/products/accessories.svg` (vaso para todo), variantes «talla S,M,L / color Negro,Azul». Ficha con imagen rota y «· P169…» con punto suelto. Pide SKU y código de barras. | media | `a-2-producto-form-lleno-desktop`, `a-3-pos-carrito-desktop` | Productos › Nuevo |
| A10 | Inventario | El producto nuevo no lleva existencia; hay que ir a Inventario › Ajustar (4 campos) por producto. 3 productos ≈ 8 clics. | media | `a-2-ajuste-stock-desktop` | Crear producto, ver stock |
| A11 | Móvil | «Pregúntale a Nexora» tapa tarjetas de producto, barra del carrito y KPIs. | media | `a-3-pos-carrito-mobile`, `a-3-cobro-mobile` | 390 px, POS |
| A12 | Móvil, Utilidad | Tabla cortada: Utilidad y Margen fuera de pantalla. | media | `a-4-utilidad-por-producto-mobile` | 390 px |
| A13 | Móvil, cobro | «Agregar pago» bajo el pliegue del modal. | baja | `a-3-cobro-mobile` | Cobrar a 390 px |
| A14 | Varias | Objetivos táctiles < 44 px: avatar 32×32, «Ir al carrito y cobrar» 40, lector/cámara 38×44, iconos 28×36, «Quitar» 28×28, «Cerrar aviso» 18×18. | baja | `a-2-resumen-primera-vez-mobile` | — |
| A15 | Texto | «1 ventas completadas hoy»; «Ventas detalladas» muestra `not_issued` crudo; buscador POS trunca «Código o r…» a 1366; checklist sin paso «agrega productos». | baja | `a-4-resumen-hoy-desktop` | — |
| A16 | Consola/red | Cada carga del login: `POST /api/auth/refresh` 400 registrado como error de consola. | baja | log | `/` sin sesión |
| A17 | Contraste | Icono «✦» 2.03:1; enlace de registro del login 4.25:1. | baja | `a-0-login-desktop` | — |

**Salió bien:** registro con correo y términos; 2 pasos de «Primeros pasos» sin errores; venta en efectivo de 115 (ITBIS incluido 17.54); ticket 80 mm correcto (emulación de impresión); Resumen abre en «Hoy» con la venta del día.

**No probado:** sitio en vivo, invitación del operador, tema oscuro, impresora real, rol RLS de runtime (base local de superusuario), entrega real de correo (stub). Nota de montaje: `vite build` con `NODE_ENV=test` falla en la PWA (JS de 2.14 MB > 2 MiB); con `production` compila.

## Parte B · Cajera: caja ciega, «Preguntas», encuesta (copia local, `8ae06d8d`, tenancy `required`)

Cajeras Carmen (1366×768), Luis (390×844) y Prueba (exploración); plan subido a `pro` por SQL **solo en la base desechable** (Autoservicio permite 2 usuarios). Capturas y JSON de red: `C:\Users\marco\AppData\Local\Temp\cola2\b\` (`b-<paso>-<desktop|mobile>.png`).

### ¿La caja es ciega? Respuesta corta: el campo «esperado» NO llega, pero la caja NO es ciega de verdad
- **No llega el «esperado»:** Caja muestra «—» en esperado, contado y diferencia; «Preguntas» responde «Se ve al cerrar tu caja»; `GET /cash-sessions` sin campos esperados; `/cuadre` responde 400 «Cierra la caja…»; `/sales/mine/*` solo da conteos. La administradora sí lo ve (`b-14-admin-caja-completa-desktop`).
- **Sí se puede reconstruir (B-01):** con la caja abierta, la pantalla Ventas y `GET /api/sales` entregan `total`, `subtotal`, `taxTotal`, `payments[].amount/method/change/cardLast4` e `items[].lineTotal` de cada venta; con `openingAmount` (que también recibe) calcula el efectivo exacto.
- **Tras cerrar (B-02):** `/cuadre` devuelve `cashCheck.expected`, `difference`, `descuadre.cash`. El texto promete no mostrar «ni las diferencias» pero imprime «Efectivo esperado», «DIFERENCIA −10.00» y «FALTAN EN EFECTIVO». Por el código es decisión de la dueña del 21-oct, no un fallo del servidor: confirmarlo con ella y alinear el texto.

| id | pantalla | qué pasó | grav. | captura | repetir |
|---|---|---|---|---|---|
| B-01 | Ventas (caja abierta) | Lista total y método de cada venta: anula el cierre ciego. Arreglo: para el rol cajera, en `GET /api/sales` ocultar `payments`/totales de las ventas de su sesión abierta | **alta** | `b-13-ventas-desktop/mobile` | Vender 2 veces, abrir Ventas |
| B-02 | Cuadre tras cerrar | El texto contradice lo que imprime (ver arriba) | **alta** (decisión de negocio) | `b-cierreC2-final-desktop`, `b-17-cierre-resultado-mobile` | Cerrar con faltante y PIN de gerente |
| B-03 | Cierre | Cada intento errado dice «La caja no cuadra con el sistema» (o «El total de tarjeta no coincide…») y pide PIN: avisa sí/no, permite tantear. Tras 2 intentos, el 3.º con la cifra exacta (1750) se rechaza: «Ya hubo 2 intentos… PIN de otra persona» | media | `b-cierreC2-intento1-desktop`, `b-17-cierre-intento1-mobile` | Contar mal dos veces, luego bien |
| B-04 | Abrir caja | Luis abre con 1,000: «El fondo es menor que lo dejado en el último cierre (RD$ 1,500.00)». Cifra de **otra persona** y el texto dice «tu último cierre» | media | (sobrescrita) | Abrir con menos que el cierre previo del equipo |
| B-05 | Preguntas | No hay «Mis ventas de hoy»: 7 preguntas de «Mis ventas» dan la misma negativa; la Q25 de la encuesta ofrece «Mis ventas del día», lo bloqueado | media | `b-08-q-0-desktop/mobile` | Preguntas › ¿Cuánto llevo en efectivo? |
| B-06 | Encuesta | Respuesta elegida no se deshace; cerrar sin guardar pierde lo contestado sin aviso; guardar vacía dice «¡Gracias!» y cuenta; nada marca opcional/obligatorio; solo P1 explica la escala 1–5; P30 dice «la dueña»; las respuestas llevan nombre sin avisarlo; 30 preguntas en un solo scroll | baja | `b-09-encuesta-inicio-mobile`, `b-09-encuesta-guardada-mobile` | Preguntas › Encuesta |
| B-07 | Ventas 390 px | TOTAL, PAGOS y ACCIONES fuera de vista; «Completada» cortada; Ver/PDF de 28×36 | media | `b-13-ventas-mobile` | Ventas en móvil |
| B-08 | Móvil | Objetivos < 44 px: «En línea» 15×32, avatar 32×32, Cámara/Pitido 38×44, «Ir al carrito» 150×40, escala encuesta 44×40, casilla cierre 20×20 | baja | `b-02-inicio-mobile`, `b-09-encuesta-inicio-mobile` | — |
| B-09 | Escritorio | Título del cobro cortado arriba; en cuadre «Siguiente: Facturas por forma de pago» se corta a la derecha | baja | `b-06-venta1-cobro-desktop`, `b-cierreC2-final-desktop` | Cobrar; cerrar con diferencia |
| B-10 | Consola | `/auth/refresh` 400 «Falta el contexto de empresa» en el login; 403 en `/reportes` y `/reports/sales` al abrir el POS como cajera | baja | `b-console-*.json` | Abrir el POS |
| B-11 | Login | «Contraseña (no es tu PIN de caja)», pero ambas son de 6 números; el código de empresa no se recuerda | baja | `b-01-login-mobile`, `b-01b-primer-ingreso-mobile` | Primer ingreso de cajera |
| B-12 | Build | `vite build` falla en este commit: chunk de 2.1 MB supera el límite de 2 MiB del precache de Workbox (con `NODE_ENV=production` sí compiló en la parte A). **No verificado en Render** | media | — | `vite build` |

**Salió bien (visto):** cierre limpio y exacto de Prueba (sin PIN, con cuadre impreso); venta en efectivo y con tarjeta en 8–9 toques (tarjeta exige 4 dígitos y aprobación); encuesta 30 preguntas, 26 guardadas / 4 omitidas, se mantienen tras recargar con aviso «Ya respondiste»; la encuesta no bloquea vender; atajos F2/F10/F12/Ctrl+K; cambio con PIN en 5–6 toques y PIN malo → «PIN incorrecto.»; sin scroll horizontal; costos y rentabilidad ocultos a la cajera (`costAvg` ausente, `profit` null); recupera el carrito tras recargar.

**No probado:** impresión real; PIN de cajera sobre sesión de cajera; transferencia, crédito y devoluciones; cierre con tarjeta distinta en móvil; teclado físico y lector; `tsc`.

## Resumen para Claude nube
1. **Corregir antes de vender:** A1 (dos fórmulas de utilidad/margen) y B-01 (la «caja ciega» se reconstruye desde Ventas).
2. **Decidir con la dueña:** B-02 (qué ve la cajera al cerrar) y B-04 (cifra de cierre ajeno).
3. Resto: pulido de registro, móvil, objetivos táctiles y textos. Ningún 5xx ni scroll horizontal en ninguna pantalla.
