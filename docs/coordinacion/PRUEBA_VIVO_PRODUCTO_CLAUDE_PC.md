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

<!-- PARTE B (Preguntas, encuesta, caja ciega): pendiente del segundo agente -->
