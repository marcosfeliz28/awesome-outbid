# Informe de revisión de los borradores N34–N41 (30-oct-2026, Norexos 4)

**Aviso importante:** estos 8 borradores **no los escribió el modelo local** (no estaba disponible en la sesión del Revisor): los escribió Claude (Norexos 4) leyendo las entradas de `docs/sistema/`. Por eso **esta revisión no es independiente**: es una autocomprobación con conteos de `grep`. Conviene que Claude PC la repita con su script antes de dar nada por aceptado.

| Tarea | Salida | Criterio de la cola | Comprobación hecha | Resultado |
|---|---|---|---|---|
| N34 | `guia-cajera-1pagina.md` | cada paso con cita (`grep -c ':[0-9]'` ≥ pasos) | 17 pasos; 17 líneas con cita | ACEPTADA (autocomprobación) |
| N35 | `glosario-simple.md` | una fila por término, mismo orden, ≤15 palabras | 52 términos en la entrada, 52 filas; ninguna definición pasa de 15 palabras | ACEPTADA (autocomprobación) |
| N36 | `faq-roles.md` | cada respuesta con cita | 12 preguntas; 12 con cita | ACEPTADA (autocomprobación) |
| N37 | `tarjetas-cobros.md` | cada tarjeta con cita; lo no desplegado lo dice | 17 tarjetas; 17 con cita; 3 tarjetas dicen «NO está desplegado todavía» | ACEPTADA (autocomprobación) |
| N38 | `gv-secretaria.md` | cada paso con cita | 20 pasos; 19 con cita o referencia a la entrada (el paso restante es una advertencia sin dato nuevo) | ACEPTADA con reserva |
| N39 | `lista-mercancia.md` | 8 a 12 casillas con cita o regla; incluye las 3 verificaciones | 12 casillas, todas con cita o regla; la regla de las 3 verificaciones está en la casilla 1 y 12 | ACEPTADA (autocomprobación) |
| N40 | `ayuda-pantallas-corta.md` | una entrada por pantalla de la tabla | 18 pantallas en la entrada, 18 filas; donde la entrada no dice qué pasa después, [FALTA DATO] | ACEPTADA (autocomprobación) |
| N41 | `glosario-en.md` | una fila por término | 52 filas; nombres de botones y rutas sin traducir | ACEPTADA (autocomprobación) |

## Palabras prohibidas
`e-CF`, `DGII`, `NCF`, `Nexora` solo aparecen en las **filas de término** de los glosarios N35 y N41, porque la entrada tiene esos términos («NCF / e-CF», «Norexos / Nexora POS») y la cola pide una fila por término. En ambas la definición **niega** la función (el sistema no lo emite) o marca «Nexora POS» como nombre anterior. Ningún otro borrador las contiene. Si un script de prohibidas las marca, es este caso.

## Qué NO comprobé
- Las citas `archivo:línea` no se verificaron contra el código; se copiaron de las entradas de `docs/sistema/`. Una cita equivocada en la entrada se repite aquí.
- Las traducciones (N41) no las vio una persona bilingüe.
- No se probó nada en pantalla.
