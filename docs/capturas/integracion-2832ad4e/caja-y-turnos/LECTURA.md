# Validación visual local · portal de cierre de Caja/turnos

## Alcance y condiciones

- Candidato exacto: `2832ad4e0a884efa2496718b6b970368ce5a0966`.
- UI real del candidato en Chromium local; API simulada exclusivamente en `127.0.0.1`.
- Usuario, terminal, sesión e importes totalmente ficticios.
- Se bloquearon hosts externos y cualquier petición de escritura. Resultado: **0 escrituras**.
- Únicas acciones: abrir el portal, recorrerlo visualmente y pulsar **Cancelar/Cerrar**. No se confirmó ningún cierre ni se movió dinero.
- Escenarios: 1440×1000 y 390×844, claro y oscuro.

## Resultado

**4/4 escenarios aprobados en 7.8 s. Sin hallazgos visuales bloqueantes.**

1. El portal queda dentro del viewport en los cuatro escenarios. El ancho del documento fue exactamente 1440/1440 y 390/390; no hubo desplazamiento horizontal.
2. La tarjeta mide 540×900 px en escritorio y 366×776.47 px en móvil. El contenido usa desplazamiento interno. La altura total del contenido fue 1.502 px en escritorio y 2.190 px en móvil.
3. El CTA dorado final se ve completo: 52.56 px de alto en escritorio y 81.13 px en móvil. El botón X mide 44×44 px.
4. La apariencia verde/dorada se aplica al portal: `--primary` es `#176b51` en claro y `#61e4b2` en oscuro; el CTA usa el gradiente `#f9dc8e → #dcb45b → #f6d687` con texto `#241d0b`.
5. Contraste calculado: texto del CTA contra el punto menos favorable del gradiente **8.54:1**; texto general del diálogo **15.99:1** en claro y **13.92:1** en oscuro.
6. En móvil el formulario es largo. El final, la acción de cierre y Cancelar se alcanzan sin solapamientos. La evidencia incluye la parte superior e inferior.
7. En los cuatro escenarios se canceló el portal y desapareció correctamente. No se emitió ninguna petición de negocio.

## Comparación con el candidato anterior

Comparación de fuente, no captura visual previa: frente a `7b9348dc`, el candidato agrega reglas acotadas al portal `.modal:has(.close-cash)`, sustituye la herencia visual antigua por verde/dorado y conserva la geometría. No se observó una regresión de dimensiones o interacción.

## Evidencia

- `1440-light-portal-arriba.png`
- `1440-dark-portal-arriba.png`
- `390-light-portal-arriba.png`
- `390-light-portal-abajo.png`
- `390-dark-portal-arriba.png`
- `390-dark-portal-abajo.png`
- `RESUMEN_SANEADO.json`
- Cuatro archivos `*-metricas.json` con las medidas crudas de cada escenario.

## Límites

- Esta validación es únicamente visual y local; no certifica permisos, reglas de cierre, impresión ni servidor.
- No se confirmó cierre, no se probó PIN, no se imprimió, no se usaron datos reales y no se consultó producción.
