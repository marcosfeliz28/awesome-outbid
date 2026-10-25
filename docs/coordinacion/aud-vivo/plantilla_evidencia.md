# Plantilla de evidencia — AUD-VIVO

Plantilla vacía; no acredita pruebas realizadas ni hallazgos observados.

## Sesión y cobertura

- Fecha y hora UTC: `<AAAA-MM-DDThh:mm:ssZ>`; zona horaria del producto: `<visible/no disponible>`.
- URL observada: `<ruta de https://nexorapos.net>`.
- Empresa verificada en pantalla: `aud-chatgpt`; evidencia: `<captura o referencia>`.
- Rol activo: `<dueña/gerente/cajera>`; identificador de auditoría del usuario: `<alias sin credenciales>`.
- Correlación local: `AUD-VIVO-<fecha>-<rol>-<secuencia>`; ID del producto, si es visible: `<ID/no disponible>`.
- Casos previstos: `<n>`; ejecutados con resultado observable: `<n>`; conformes: `<n>`; fallidos: `<n>`; bloqueados antes de ejecutar: `<n>`; pendientes: `<n>`.
- Resultado de cobertura: `<completa/parcial/no ejecutada>`. **Cero casos ejecutados no equivale a aprobado.** Un caso bloqueado no cuenta como conforme.

## Clasificación previa a severidad

| Estado | Criterio y tratamiento |
| --- | --- |
| Fallo de producto observado | La interacción se ejecutó y existe evidencia de una diferencia entre resultado esperado y real. Asignar severidad según impacto demostrado. |
| Bloqueo del entorno/acceso | Falta de conexión, repositorio, sesión o permisos del entorno impide ejecutar. Registrar impedimento y pruebas no realizadas; no atribuirlo al producto sin evidencia. |
| Bloqueo de producto observado | Dentro de la empresa y rol verificados, una función del producto impide continuar. Documentar la acción y su resultado; no confundir con falta de acceso al entorno. |
| Conocido, no reproducido | Hallazgo previo con referencia que no se logró repetir en esta sesión. Registrar condiciones y alcance; no marcar corregido sin una prueba suficiente. |
| Pendiente/no ejecutado | Caso sin interacción completada ni resultado observable; no tiene veredicto de conformidad. |

## Severidad de fallos de producto

| Nivel | Criterio de impacto demostrado |
| --- | --- |
| S1 — Crítica | Exposición entre empresas, pérdida irreversible de información o corrupción de operaciones financieras confirmada, con impacto grave. |
| S2 — Alta | Flujo esencial de venta, cobro o cierre inutilizable sin alternativa razonable; permiso incorrecto relevante o cálculo materialmente erróneo confirmado. |
| S3 — Media | Función parcialmente degradada o información incorrecta con alternativa viable y alcance limitado. Incluye respuestas de IA erróneas cuyo impacto no alcance S1/S2. |
| S4 — Baja | Defecto visual, de texto o de interacción menor que no altera datos ni impide completar el flujo. |

La severidad depende del impacto observado; se indica aparte la certeza: `<confirmado/indicio pendiente>`. Un bloqueo del entorno no recibe una severidad de producto.

## Registro por hallazgo o bloqueo

### `<ID local> — <título concreto>`

- Clasificación: `<estado de la tabla>`; severidad: `<S1–S4/no aplica/pendiente de evidencia>`; certeza: `<confirmado/indicio>`.
- Fecha y hora UTC: `<inicio>` a `<fin>`.
- Empresa y rol verificados: `aud-chatgpt` / `<rol>`; ruta: `<URL>`.
- Precondiciones y datos de prueba: `<estado inicial, filtros, período, IDs visibles y valores pertinentes>`.
- Pasos exactos:
  1. `<acción humana y selección visible>`.
  2. `<acción que desencadena el resultado>`.
- Esperado: `<comportamiento y fuente: regla, texto visible o requisito; señalar si es hipótesis>`.
- Real: `<texto exacto, valores y efecto observado; separar interpretación>`.
- Evidencia: `<ruta de captura>`; hora de captura: `<UTC>`; qué demuestra: `<hecho>`.
- Persistencia comprobada: `<qué muestra una recarga o consulta posterior/no comprobada>`.
- Impacto y alcance comprobados: `<operación, número de registros o usuarios; sin extrapolar>`.
- Reproducción: `<intentos y resultados/no repetida para evitar duplicar operaciones>`.
- Estado final de los datos creados: `<IDs y estado final; sin asumir limpieza>`.
- Si está bloqueado: `<impedimento concreto, origen observado y casos afectados>`.
- Si es conocido no reproducido: `<fuente previa, condiciones actuales y evidencia de la comprobación>`.

## Correlación pregunta–datos para Nexora/IA

Repetir este bloque por pregunta; conservar la correlación local del caso.

- Pregunta literal y hora UTC: `<texto>` / `<hora>`.
- Contexto visible: empresa `aud-chatgpt`, `<rol>`, `<tarjeta o pantalla>`, `<filtros, período y zona horaria>`.
- Datos de referencia **antes** de preguntar: `<IDs, importes, cantidades y captura con hora>`; fuente: `<pantalla o documento autorizado>`.
- Respuesta literal o captura: `<evidencia>`; hora: `<UTC>`; fuentes citadas por Nexora: `<fuentes/no mostradas>`.
- Comparación: `<dato esperado> → <afirmación de Nexora> → <coincide/difiere/no verificable>`.
- Posibles cambios entre consulta y respuesta: `<operaciones concurrentes observadas/no comprobado>`.
- Conclusión limitada a la evidencia: `<respuesta sustentada/error observado/evidencia insuficiente>`.

No incluir contraseñas, tokens ni datos de otras empresas en documentos o capturas compartidas. Conservar los hechos necesarios para reproducir y verificar cada conclusión.
