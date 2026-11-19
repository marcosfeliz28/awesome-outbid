# Orden de Marcos a Norexos 2 (18-nov-2026): transferencias y anulación del 17-nov

Marcos pidió que esto lo haga **Norexos 2** (no Norexos 1). Origen: cierre diario del 17-nov y `reportes.py anomalias 2026-11-17`.

## 1. Transferencias sin verificar (misma referencia «1111» en todas)

| Factura | Monto RD$ | Cuenta |
|---|---|---|
| FS-0000691 | 1,400 | Popular MacGen ···3620 |
| FS-0000693 | 3,000 | BHD MacGen ···0015 |
| FS-0000696 | 3,800 | BHD MacGen ···0015 |
| FS-0000700 | 5,700 | Popular MacGen ···3620 |
| FS-0000702 | 5,500 | Popular MacGen ···3620 |
| FS-0000704 | 3,500 | Popular Grupo Génesis ···9797 |

Que las seis lleven la misma referencia es una señal para revisar, no una acusación. Verificar **solo** las que aparezcan en el estado del banco con ese monto y cuenta. Verificar es irreversible por las herramientas (`POST /gv/payments/:id/review` o el equivalente de ventas): mostrar el cotejo a Marcos antes de aplicar (regla 6 de `CLAUDE.md`). Las que no aparezcan en el banco se dejan sin verificar y se le avisa.

## 2. Solicitud de anulación

FS-0000686: revisión pendiente. Mostrarle a Marcos los datos (quién la pidió, motivo, monto) y aplicar solo con su aprobación.

## 3. Descuentos aprobados por la misma vendedora (para su conocimiento)

FS-0000702 (15 %, Jade), FS-0000695 (12 %, Jade), FS-0000697 y FS-0000698 (15 %, Lizbeth). No se cambia nada; Marcos decide.

Norexos 1 no verifica ni anula nada de esto.
