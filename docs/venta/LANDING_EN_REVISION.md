Borrador sin verificar, hecho por script (cruce por palabras de riesgo). Fuente: docs/venta/LANDING_EN_PLANES.md (origin/claude-pc/cola-b11, 5e41b712 y siguientes) contra docs/venta/LANDING_TEXTOS.md (origin/nexora-cloud). PARCIAL: el cruce es por palabra clave; no es una lectura completa de cada afirmación.

| Línea | Afirmación del inglés | Palabra de riesgo | ¿Respaldada en el original? |
|---|---|---|---|
| 1 | Borrador sin verificar, hecho por modelo local (sin publicar: solo con la orden escrita de la dueña). Fuente: docs/venta/LANDING_TEXTOS.md (origin/nex | e-CF | sí (original contiene "e-cf") |
| 33 | 5. **[RETIRADO]** Facturación DGII: fuera de la versión 1; pendiente de revisión legal (tarea 69). | DGII | sí (original contiene "dgii") |
| 34 | 6. **Funciona con o sin internet.** La caja sigue vendiendo sin conexión y | sin conexión | sí (original contiene "sin conexi") |
| 42 | / Facturación NCF (DGII) / [RETIRADO: pendiente, tarea 69] / No / No (otro país) / | DGII | sí (original contiene "dgii") |
| 45 | / Offline / Sí / Parcial / No / | offline | sí (original contiene "sin internet") |
| 57 | 4. **¿Emite facturas con NCF?** [RETIRADO: pendiente de revisión legal, tarea 69]. | NCF | sí (original contiene "ncf") |
| 58 | 5. **¿Qué pasa si se va la luz o internet?** La caja sigue vendiendo sin conexión | sin conexión | sí (original contiene "sin conexi") |
| 60 | 6. **¿Mis datos están seguros?** Control de acceso por rol. | segur | sí (original contiene "segur") |

Total de líneas marcadas: 8. Sin respaldo en el original: 0.
El original no se modifica.

## Veredicto por fila (revisión de Claude PC, cruce por palabra clave)
- Líneas 33, 42 y 57 (DGII / NCF): el original contiene la palabra, pero la afirmación es legal y está fuera de la versión 1. Ya retiradas en el inglés (5e41b712 y cb4f2382). Pendiente de revisión legal (tarea 69 de Norexos 1). NO usar.
- Líneas 34 y 58 (funciona sin conexión): el original la afirma. No verificado en código (no se ejecutó la caja sin red). Usar solo tras comprobarlo.
- Línea 45 (tabla Offline: Sí / Parcial / No): comparación con competidores; el original no la respalda por sí solo. No verificado. Pendiente.
- Línea 60 («¿Mis datos están seguros?» / «Control de acceso por rol.»): la palabra «segur» está en el original, pero «control de acceso» no tiene respaldo técnico verificado en el código. Sin respaldo técnico comprobado: NO publicar esa afirmación.
- Línea 1: es la cabecera de este archivo, no una afirmación de la portada.
Nada de esto cambia el original (docs/venta/LANDING_TEXTOS.md).
