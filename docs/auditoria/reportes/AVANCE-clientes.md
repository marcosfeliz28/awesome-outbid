# Avance · Clientes y crédito (A5) · 2-nov

- Revisados: 6 de 6 (datos y lógica). Hallazgos: 7 (Alto 0 · Medio 3 · Bajo 4). Detalle: `HALLAZGOS-clientes.jsonl`, fichas en `clientes/`.
- Deuda total **227,900** igual en: antigüedad, clientes-con-mas-deuda, `/credit-accounts`, suma de `creditBalance` en `/sales` y cierre diario (`reportes.py`). Cobros del mes 155,650 = pagos crédito/cod (383,550) − deuda (227,900).
- Edades de deuda recalculadas en hora RD: 10/10 correctas (incluye ventas de 21:00+ RD).
- Sin cambios de código: los Medios tocan cifras de dinero → requieren visto bueno de la dueña (CLI-01, CLI-02); CLI-03 es un atajo ya documentado.
- Pendiente: PDF/Excel y `/guia` daban 404 a las 08:25 RD (exportador sin desplegar); ver nota final abajo.

Nota final (09:18 RD): exportador PDF/Excel y `/reportes/<name>/guia` seguían en 404 en producción; sección 5 de las fichas queda **pendiente** hasta que se despliegue.
