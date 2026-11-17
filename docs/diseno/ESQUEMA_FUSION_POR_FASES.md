# Esquema del rediseño Fusión premium, fase por fase (orden de Marcos, 17-nov-2026)

Referencia única: **lámina 03 Fusión** generada por Dot. No Aurora, no violeta, no maquetas viejas.

## Quién hace qué

| Paso              | Quién           | Qué entrega                                                                                                                                                    | Qué cuenta como hecho                                                                                  |
| ----------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1. Diseñar        | ChatGPT con Dot | Imágenes del área (escritorio 1440 y celular 390, claro y oscuro)                                                                                              | Imágenes en el chat de Marcos o en `docs/diseno/fusion03/fase-N/`                                      |
| 2. Autorizar      | **Marcos**      | «Aprobado fase N» o cambios                                                                                                                                    | Su palabra en el chat. Sin esto no se programa nada                                                    |
| 3. Mandar la fase | Dot             | El código de esa fase: rama `dot/rediseno-fase-N` (o paquete `git bundle` si la subida falla), con el código completo del commit y la versión de partida       | Claude comprueba que el commit llegó idéntico                                                          |
| 4. Entrar la fase | Claude nube     | Integra el commit **tal cual**, corre las 3 pruebas automáticas, el recorrido de cajera con datos de demostración y capturas al lado de las imágenes aprobadas | Informe: pasa, falla (archivo:línea) y diferencias con la imagen. No corrige ni reinterpreta el diseño |
| 5. Ver            | **Marcos**      | Revisa las capturas reales de la fase                                                                                                                          | «Publicar fase N» o cambios (vuelve a Dot)                                                             |
| 6. Publicar       | Claude nube     | Solo la web (`nexora-pos-web`), con los 3 CI en verde; verifica después en vivo                                                                                | Fase N en la tienda; reversión al commit anterior si algo falla                                        |

Una fase a la vez: la siguiente empieza cuando Marcos dice «publicar» (o la descarta).

## Fases

| Fase | Área                                                          | Estado                |
| ---- | ------------------------------------------------------------- | --------------------- |
| 1    | Caja (POS) e Inicio                                           | Diseño en curso (Dot) |
| 2    | Productos y Mercancía                                         | Pendiente             |
| 3    | Reportes y Cierre de caja                                     | Pendiente             |
| 4    | GV (cursos, caja GV, Mi incentivo)                            | Pendiente             |
| 5    | Resto (clientes, usuarios, ajustes, estados de error y carga) | Pendiente             |

Dot puede reordenar o dividir fases con el visto bueno de Marcos.

## Límites en todas las fases

- Solo presentación (`apps/web/src`, `packages/ui`) más pruebas y documentos. Nada de API, base de datos, autenticación, dinero ni instalador.
- No romper: F12 «Cobrar», buscador y lector de código, recibos, devoluciones, cierre ciego, sin conexión, transferencias, GV.
- Cifras y botones siempre legibles en 2D; el 3D es adorno. Respetar «reducir movimiento».
- La pieza 1 del panel de operador es de Dot y va aparte. El obrero está en pausa.
- Ningún secreto por chat ni en el repositorio.
