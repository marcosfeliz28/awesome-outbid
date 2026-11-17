# Esquema del rediseño Fusión premium, fase por fase (orden de Marcos, 17-nov-2026)

Referencia única: **lámina 03 Fusión** generada por Dot. No Aurora, no violeta, no maquetas viejas.

## Flujo (afinado por Marcos, 17-nov, vía Dot): una imagen, un área, a la vez

1. **Dot** genera **una** imagen de **un** área (estilo Fusión premium) y se la muestra a Marcos en su conversación.
2. **Marcos** la aprueba o pide cambios. Sin imagen aprobada no se programa nada.
3. **Claude nube** implementa esa área **poco a poco**, solo presentación, siguiendo la imagen aprobada (sin reinterpretarla). Se acepta que convivan estilos viejos y nuevos mientras se avanza.
4. **Claude nube** compara el resultado **real** (capturas de la app en 1440 y 390, claro y oscuro) contra la imagen aprobada y documenta las diferencias en `docs/diseno/fusion03/<area>/COMPARACION.md`.
5. Pasan los controles técnicos: 3 pruebas automáticas en verde, recorrido de cajera con datos de demostración, accesibilidad.
6. **Marcos** (o Dot) aprueba la publicación de esa área; Claude publica solo la web y verifica en vivo.
7. Recién entonces se pasa a la siguiente área.

## Áreas (en este orden)

| #   | Área                      | Estado                                  |
| --- | ------------------------- | --------------------------------------- |
| 1   | Punto de venta / Caja     | Imagen en generación (Dot). Sin aprobar |
| 2   | Inicio                    | Después de Caja                         |
| 3   | Productos y Mercancía     | Pendiente                               |
| 4   | Reportes y Cierre de caja | Pendiente                               |
| 5   | GV                        | Pendiente                               |
| 6   | Resto                     | Pendiente                               |

## Límites en todas las fases

- Solo presentación (`apps/web/src`, `packages/ui`) más pruebas y documentos. Nada de API, base de datos, autenticación, dinero ni instalador.
- No romper: F12 «Cobrar», buscador y lector de código, recibos, devoluciones, cierre ciego, sin conexión, transferencias, GV.
- Cifras y botones siempre legibles en 2D; el 3D es adorno. Respetar «reducir movimiento».
- La pieza 1 del panel de operador es de Dot y va aparte. El obrero está en pausa.
- Ningún secreto por chat ni en el repositorio.
