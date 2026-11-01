# CI rojo del 1-nov: trabajo WIP de Claude PC (no es fix final)

Rama: `claude-pc/fix-ci-wip`. No mezclar en `nexora-cloud`. Base: `origin/claude-pc/fix-ci-mes` (62d78b6 y anteriores).

## Qué cambia cada commit (de la base hacia adelante)

| Commit | Qué hace | Autor de la idea |
|---|---|---|
| 4f994d7 | Desglose: fila «Devoluciones sin detalle» para devoluciones sin líneas (heredadas), restadas por fecha de venta; cobros por forma de reembolso. | Claude PC, aprobado (opción A del desglose) |
| e0efeda | Desglose: fila «Devoluciones de ventas anteriores» (B2). Se quita después con la opción A. | Claude PC |
| 62d78b6 | Opción A aprobada por la dueña: año y resumen atribuyen la devolución a la fecha de la VENTA original; quita la fila B2. | Claude PC, aprobado |
| 0912875 | `/reports/profit` (página de devoluciones), año anterior y tendencia del resumen por fecha de venta. Helper `forEachPeriodReturn` con filtro de venta. Prueba de resumen y utilidad de otro mes. | Claude PC, pedido de Norexos 1 |
| f7a7b94 | Resumen: mezcla de cobros (`returnedBreakdown`) por fecha de venta; costo del resumen resta solo lo que reingresa (partes con `restock`); lectura estable (`stableMonth`) en pruebas de cuadre. | Claude PC, pedido de Norexos 1 |
| 68478b8 | Re-anclaje de citas en `docs/sistema`. | script del repo |

No se cambió el criterio de costo (`SaleReturn.costTotal` se guarda igual; sin reingreso el costo se conserva). No se tocó el cierre de caja ni el ITBIS.

## Las 8 fallas de la última corrida completa (base limpia, 1 de 2)

| # | Prueba | Clasificación |
|---|---|---|
| 1 | `api.test` · R9-dinero-1: la devolución que completa la línea descuenta el costo de la devolución histórica | **Mía.** Nace de cambiar la utilidad a fecha de venta (0912875/f7a7b94). La expectativa es la regla de costo vigente: no se cambia; el cambio debe ajustarse a ella. |
| 2 | `dinero` · devolución de una venta de otro mes: resumen y utilidad de hoy no cambian (diferencia 400) | **Sin confirmar.** Puede ser mía (resumen aún resta algo por otra vía) o carrera entre suites (escritura concurrente de 400 en la ventana de lectura). |
| 3 | `dinero` · círculo del año y desglose (diferencia 60) | **Carrera entre suites (sospecha).** Persistió con lectura estable; origen no aislado. |
| 4 | `dinero` · devolución heredada sin líneas (diferencia 80) | **Carrera entre suites (sospecha).** Mismo residuo de 80 que en #5. |
| 5 | `dinero` · devolución de una venta del mes anterior (diferencia 80) | **Carrera entre suites (sospecha).** Mismo residuo. Al terminar la corrida, octubre y noviembre cuadran al centavo. |
| 6-8 | `desglose-suma-api` ×3 · «caja es obligatorio» | **Preexistente.** Ocurre también en 4f994d7 y en 3e27247: el arranque de caja de la prueba falla por el estado que dejan otras suites. No es de este trabajo. |

Además, a nivel de archivo: `reportes-margen-api` falla al abrir caja (fondo menor que el último cierre), **preexistente**; `gv-adversarial-independiente` falla solo en el equipo local porque hay `.env` (no es de CI).

## Lo que no está resuelto

- Residuo de 80/60 en los cuadres exactos: se sospecha carrera entre suites. Probar: aislar qué suite escribe ventas o devoluciones de hoy durante la lectura, o limpiar estado en `afterAll`.
- Regla de costo entre resumen y utilidad: el resumen ya resta solo lo que reingresa; falta confirmar que la utilidad por producto coincide en todos los casos (incluidas devoluciones heredadas sin `items`).
- Fuera de alcance de este trabajo (decidir con la dueña): caja, ingresos, formal y cobros por forma de pago siguen con fecha de devolución en algunos puntos.
