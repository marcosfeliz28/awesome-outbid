# Auditoría total de los 43 reportes · plan y cronograma (2-nov, orden de la dueña)

Meta: cada reporte (pantalla, PDF y Excel) con **datos correctos**, **lógica correcta**, **explicación que entienda cualquier persona de 18 a 70 años**, y **coherente con los demás reportes** (mismas cifras para lo mismo). La contable encontró datos erróneos: eso es lo primero a cazar.

## Reglas (no se negocian)
- **Datos reales SOLO por lectura** (solo GET) con `docs/coordinacion/claude-nube/entrar.py`. Nunca POST/PUT/PATCH/DELETE, nunca verificar/rechazar transferencias, nunca tocar mercancía, precios ni caja. Nunca imprimas credenciales.
- Regla de dinero: margen = (precio − costo)/precio **sin restar ITBIS**; mínimo 15 %, jamás bloquear una venta por margen. Devoluciones = opción A (período de la venta original).
- Sin acceso a la base de datos ni a Render. Solo la API pública con el usuario de la nube.
- **UNA sola subida (push)** a tu rama al final; cada push cancela el CI previo. Espera los 3 CI (verify, windows-installer, render-images) sobre ese SHA.
- Todo cambio de código: mínimo, con prueba, seguridad-20, sin saltar pruebas.
- Los hallazgos de DINERO (cifra equivocada) los presenta Norexos 1 a la dueña antes de desplegar.

## Qué hace cada agente con CADA reporte (ficha)
Guarda `docs/auditoria/reportes/<grupo>/<nombre>.md` con:
1. **Qué dice** (columnas, filtros, rango) y captura de 3 filas reales.
2. **Recálculo independiente** de al menos 2 cifras por otro camino (otro endpoint, suma a mano de filas, `/dashboard/summary`, `/sales`). Diferencia = hallazgo. Anota el rango y la hora.
3. **Lógica**: ¿el nombre del reporte coincide con lo que calcula? Casos borde: mes sin datos, devolución en otro mes, anulada, crédito, envío, descuento, zona horaria RD.
4. **Entendible 18–70**: lee la guía (`/reportes/:name/guia`) y la tabla como una persona sin estudios contables. ¿Los títulos, columnas, signos (−), % y totales se entienden? Propón texto en español claro (sin jerga: «margen», «ticket» se explican).
5. **PDF y Excel**: descarga ambos (`/reports/:name/export?format=pdf|xlsx`), convierte el PDF a imagen y míralo: gráficas legibles, nada cortado ni fuera de lugar, tildes, orden de columnas, total al final, misma cifra que la pantalla.
6. **Veredicto**: OK / HALLAZGO (Alto: cifra equivocada o engañosa · Medio: confuso o inconsistente · Bajo: estética).

## Base de datos de hallazgos (centralizada)
Cada agente escribe `docs/auditoria/reportes/HALLAZGOS-<grupo>.jsonl`, una línea por hallazgo:
`{"id":"<grupo>-NN","reporte":"...","severidad":"Alto|Medio|Bajo","tipo":"dato|logica|texto|pdf|sincronia","que":"...","esperado":"...","obtenido":"...","como_reproducir":"...","estado":"abierto|corregido","commit":"","contra_audit":""}`.
Norexos 1 junta todo en `HALLAZGOS_TOTAL.jsonl` y un `RESUMEN.md`; ese archivo se le entrega a ChatGPT para la **contra-auditoría** (campo `contra_audit` lo llena ChatGPT: confirma/discrepa).

## Reparto
| Agente | Alcance | Rama de salida |
|---|---|---|
| A1 Sonnet | Ventas (10) | claude-pc/aud-ventas |
| A2 Sonnet | Dinero (10) | claude-pc/aud-dinero |
| A3 Sonnet | Margen (9) | claude-pc/aud-margen |
| A4 Sonnet | Inventario (8) | claude-pc/aud-inventario |
| A5 Sonnet | Clientes y crédito (6) | claude-pc/aud-clientes |
| A6 Opus | **Sincronía entre reportes** (mismo total en dashboard, ventas, dinero, margen; devoluciones; ITBIS; rangos de fecha) y los informes mensual/anual/formal | claude-pc/aud-sincronia |
| A7 Sonnet | **Lenguaje claro 18–70** de las 43 guías + PDF de muestra para impresión (reporte «Genesis») | claude-pc/aud-lenguaje |
| ChatGPT PC | Termina la auditoría A–Z del 1-nov; después contra-auditoría (datos de prueba, sin datos reales) | chatgpt-pc/auditoria-* |
| ChatGPT nube | Contra-auditoría de `HALLAZGOS_TOTAL.jsonl` con PostgreSQL de prueba | chatgpt-nube/contra-auditoria |
| Claude PC (laptop) | Revisión visual en pantalla/impresión con la dueña (Playwright) cuando esté presente | claude-pc/aud-visual |
| IAs locales (PC) | Generar datos de prueba y revisar ortografía/tildes (solo lectura del repo) | — |

## Cronograma (hora RD)
- 08:30 Plan y reparto (este archivo). 08:45 agentes A1–A7 arrancan.
- 09:00 despliegue de lo ya mezclado (Norexos 1, aparte).
- 10:30 primera entrega de cada agente (fichas + hallazgos). Norexos 1 consolida.
- 12:00 arreglos de hallazgos Alto y Medio con CI. 14:00 `HALLAZGOS_TOTAL` y `RESUMEN.md` listos.
- 14:00+ contra-auditoría de ChatGPT; resultado a la dueña. Avances: cada agente actualiza `docs/auditoria/reportes/AVANCE-<grupo>.md` (n de reportes revisados / hallazgos) y responde a Norexos 1 cuando se le pida.
