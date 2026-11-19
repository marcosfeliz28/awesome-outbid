---
name: informe-triple
description: >
  Para Norexos 2 (Mercancía). Úsalo ANTES de mandarle a la dueña cualquier cifra, lista, total, estado
  de factura, banco o cuadre. Obliga a leer el dato 3 veces por caminos distintos, letra por letra, y a
  decir qué no se comprobó. Nace de errores del 27–29 oct (lista incompleta, banco mal emparejado, 12 vs 65).
---

# Informe triple (orden de la dueña, 29-oct-2026)

**Antes de enviar un dato, 3 lecturas independientes y se muestran.** No reemplaza a `mercancia` ni a `ordenes-duena`; se suma.

## Las 3 lecturas
1. **Sistema:** consulta directa, sin filtros, con conteo y suma (N, total).
2. **Otro camino:** el mismo dato desde otra fuente (reporte, suma a mano de las filas, estado del banco, voucher, chat de trabajo).
3. **Recalculo letra por letra:** monto, nombre, fecha, referencia y número de factura copiados tal cual de la fuente; sumar de nuevo y comparar.

Si las tres no coinciden: se muestra la diferencia y se dice «no cuadra»; no se elige una.

## Reglas que fallaron (y su comprobación)
- **Sin filtro primero.** Total sin filtrar, luego cada filtro; la diferencia debe tener nombre (FS-18 se perdió por filtrar solo «cod»).
- **Todo el periodo.** Revisar desde la primera fecha del mes, no desde «lo reciente» (65 transferencias, no 12).
- **Un pareo de banco = 3 señales:** monto, fecha y nombre/referencia. Con 2 es «posible», no «confirmado»; si luego aparece otra factura que encaja igual, avisar y revisar la anterior (pasó con 7,800: FS-288 vs FS-328).
- **Un vacío no es cero:** probar la lectura con un caso que existe antes de decir «no hay».
- **Hora:** el sistema guarda UTC; convertir a hora de RD (−4 h).
- **Verificar lo que se aplicó:** releer después de aplicar; si el sistema no deja (ej. corregir un cobro ya registrado), decirlo y no inventar otra vía.

## Formato del mensaje (máx. 8 líneas en el celular)
1. Resultado en una línea. 2. Las cifras con sus 3 lecturas («sistema X · banco Y · recálculo Z»). 3. **Qué NO comprobé.** 4. Qué necesito de ella (pregunta A/B).
