# Validación visual local · Configuración → Negocio y reglas

## Alcance y condiciones

- Candidato exacto: `0d1e00ccfedf2db6e5e082a5f1c40a84198dc49c`.
- Es descendiente de `81f31094`; la nueva punta agrega las traducciones del resumen de impuestos y de las duraciones.
- UI real del candidato con API completamente sintética en loopback.
- Empresa, usuario, terminal, reglas y valores totalmente ficticios.
- Hosts externos bloqueados y escrituras rechazadas. Se navegó y leyó únicamente: **0 escrituras**.
- Cobertura: 1440×1000 y 390×844, claro/oscuro, español/inglés.

## Resultado

**8/8 escenarios aprobados en 10.7 s. Sin hallazgos dentro del alcance.**

1. El tab activo muestra `Negocio y reglas` en español y `Business and rules` en inglés.
2. El resumen muestra `ITBIS 18% incluido · Ticket 80 mm` y `ITBIS 18% included · Receipt 80 mm` según el idioma.
3. Las reglas muestran `45 días`, `60 días`, `7 días` en español y `45 days`, `60 days`, `7 days` en inglés.
4. La sección de tienda muestra en inglés `Registers (number and name on the cash reconciliation)` y `Cashiers (number on the cash reconciliation and reports)`; en español conserva sus equivalentes.
5. No hubo desplazamiento horizontal: ancho del documento 1440/1440 y 390/390.
6. En móvil, el tab inglés se parte de forma natural y mide 169×55 px; el español mide 169×44 px. Ninguno queda recortado.
7. Resumen y reglas miden 356 px dentro del workspace móvil de 358 px. En escritorio miden 908.8 px dentro de 1152.8 px.
8. No se abrió el editor, no se subió logo, no se probó Google Drive, no se guardó configuración y no se tocaron datos.

## Comparación útil con `81f31094`

La revisión de fuente muestra que `0d1e00cc` reemplaza los fragmentos que quedaban en español en modo inglés: `incluido/adicional`, `Ticket` y `días`. La ejecución visual confirmó los valores equivalentes en cada idioma para el caso de ITBIS incluido, la etiqueta de recibo y las duraciones. La variante de impuesto adicional se cotejó en el código.

## Evidencia representativa

- `1440-light-es-top.png`
- `1440-dark-en-top.png`
- `390-light-en-top.png`
- `390-dark-es-store.png`
- `RESUMEN_SANEADO.json`
- Ocho archivos `*-metricas.json` con las medidas crudas.

## Límites

- Esta validación no certifica guardado, permisos, seguridad, dinero, Google Drive, servidor ni exactitud de datos.
- No se usaron API real, producción, Render, credenciales ni información de clientes.
