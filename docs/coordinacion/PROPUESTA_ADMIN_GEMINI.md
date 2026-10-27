# Comparativa de tableros móviles y 10 ideas «WOW» para el tablero del administrador de Nexora POS

**Autor:** Gemini (propuesta independiente de experiencia móvil y frontend), en respuesta a `ORDEN_REDISENO_ADMIN.md`. Guardado por Claude nube el 24-oct-2026, sin cambios de fondo. Se quitaron las marcas de cita del original.

## 1. Diagnóstico del tablero actual en el celular
- **Fortaleza técnica:** PWA instalable en React, TypeScript y Vite. Estado con Zustand, componentes accesibles con Radix, cálculos exactos con `Decimal`, existencias al instante entre cajas por SSE y 40 reportes en 5 grupos.
- **Problema en el celular de la dueña:** la operación está repartida en 18 pantallas. Para preguntas de 5 segundos (cuánto efectivo real hay en gavetas, qué transferencia o anulación espera permiso, cómo va el margen del día) hay que saltar entre 5 o 6 menús pensados para escritorio.

## 2. Comparativa con 5 sistemas modernos (enfoque celular)

| Criterio | Nexora (hoy) | Square | Shopify POS | Toast | Lightspeed | Loyverse |
|---|---|---|---|---|---|---|
| Claridad en 3 segundos | Media: Resumen separado de Caja, Alertas y Anulaciones | Excelente: curva horaria contra el mismo día de la semana pasada | Excelente: tarjetas de tareas y métricas en vivo | Excelente: pulso en vivo para dueños fuera del local | Alta: ventas, margen y ranking de vendedoras | Alta: una vista con venta neta, beneficio y ticket medio |
| Aprobaciones remotas con un pulgar | Fuerte en el servidor, pero repartido en 3 pantallas | Básica | Orientada a pedidos web | Buena en anulaciones | Solo lectura | No tiene |
| Control de efectivo y dinero en la calle | Superior en lógica (gaveta, dueña, bancos, contraentregas); falta una sola vista | Solo efectivo contra tarjeta | Débil | Enfocado en propinas | Básico | Muy básico |
| Margen real en vivo | Superior: (precio − costo)/precio, mínimo 15 %, costos ocultos por rol | Requiere módulos extra | Solo en reportes | Costo de recetas | Referente | Beneficio bruto en el inicio |
| Inventario: lotes, vencimientos y almacenes | Superior en el servidor | Básico | Fuerte en variantes, débil en vencimientos | No aplica | Pesado en el teléfono | No maneja lotes |
| IA integrada | Pionero: facturas con IA, Telegram y «Pregúntale a Nexora» | Resúmenes simples | Sidekick (tienda online) | Alertas | No | No |

**Qué tomar de cada uno:**
- **Square:** la curva por hora, más el margen en vivo.
- **Shopify:** las tarjetas de tareas pendientes, para transferencias y anulaciones.
- **Toast:** el pulso de las cajas en vivo.
- **Lightspeed:** el podio de vendedoras con incentivos.
- **Loyverse:** la limpieza visual del primer tercio de la pantalla.

## 3. Las 10 ideas
Todas respetan las reglas fijas: margen ≥ 15 % sin restar ITBIS, costos ocultos por rol, y la IA solo propone (aprueba una persona).
1. **Orbe de pulso y margen en vivo.** Doble anillo: ventas del día contra la meta o la semana pasada, y margen % con colores (alerta cerca del 15 %). Curva por hora interactiva.
2. **Baraja de mando de un pulgar.** Una pila única con anulaciones pendientes, transferencias por verificar (con la foto del comprobante) y cierres con diferencia. Derecha aprueba, izquierda rechaza con motivo.
3. **Gemelo digital de las cajas.** Una cápsula por caja abierta: cajera, minutos desde su último ticket y efectivo esperado. Sugiere una entrega a la dueña si pasa de un tope.
4. **Mapa de liquidez de 4 bolsillos:**
   - en gavetas;
   - en manos de la dueña;
   - en bancos o verifón, conciliado y por verificar;
   - en la calle: contraentregas y créditos.
5. **Escáner antifraude.** Resumen de la bitácora: cambios de método o de vendedora después de la venta, cierres con PIN, diferencias, descuentos altos y ventas en espera olvidadas.
6. **Isla flotante «Pregúntale a Nexora».** Barra fija con dictado por voz y 3 sugerencias según la hora.
7. **Podio de vendedoras e incentivos en vivo,** con los reversos por devolución o anulación.
8. **Historias de inventario:** bajo mínimo, lotes por vencer y desbalance entre Tienda y Casa. La IA propone un borrador de traspaso, compra o promoción, y lo aprueba una persona.
9. **Modo privacidad:** un ojo que desenfoca margen, costos y venta acumulada.
10. **Cápsula nocturna de cierre:** 4 diapositivas al cerrar la última caja, conectadas a Telegram.

## 4. Prioridad propuesta por Gemini
- **Fase A:** 9, 4, 3, 2 y 5.
- **Fase B:** 1, 7, 6, 8 y 10.
