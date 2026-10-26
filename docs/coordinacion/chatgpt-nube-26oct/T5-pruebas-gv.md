# T5 · Pruebas adversarias nuevas para GV

Fecha: 2026-10-26  
Código GV validado: `origin/claude/modulo-gv` en `a97f8fa73f096be98c31bdd63dc1d9d697eaa157`  
Archivo nuevo: `tests/gv-adversarial-t5-postgres.test.ts`  
Archivos existentes modificados: ninguno.

## Cobertura

La suite añade 13 pruebas de API y PostgreSQL para:

1. rechazar sobrepagos y evitar pendiente negativo;
2. convertir dos clics concurrentes con el mismo `operationId` en un solo pago;
3. impedir que quien registra una transferencia la auto-verifique;
4. repetir la misma importación sin duplicar cursos, inscripciones ni pagos;
5. impedir que una clave de pago se reutilice para moverlo a otra inscripción;
6. rechazar pagos importados sin clave estable;
7. negar al rol `gv` costos, configuración, usuarios, roles y datos Macgen;
8. impedir pagos nuevos en inscripciones canceladas;
9. impedir pagos nuevos en inscripciones reembolsadas;
10. impedir pagos nuevos en citas canceladas;
11. impedir pagos nuevos en citas reembolsadas;
12. rechazar fechas imposibles en cursos, pagos y citas;
13. rechazar importes con tres decimales en todos los puntos de entrada.

La suite usa identificadores únicos y desactiva al usuario temporal al terminar. No incluye datos del negocio ni secretos nuevos.

## Resultado ejecutado

En un worktree de `a97f8fa`:

- 56 migraciones aplicadas en PostgreSQL desechable;
- base de prueba sembrada correctamente;
- `tests/gv-adversarial-t5-postgres.test.ts`: **13/13 aprobadas**;
- `pnpm typecheck`: aprobado;
- ESLint focal del archivo: aprobado;
- `git diff --check`: aprobado.

Los casos estaban diseñados para fallar frente a las aperturas originales GV-05 y GV-07 a GV-13 y pasar con sus correcciones. No cubren los tres hallazgos nuevos de importación descubiertos en T1; esas regresiones deben añadirse al corregirlos porque hoy deben fallar.

## Cómo incluirla sin tocar configuración en esta entrega

Por orden de T5 no se modificó `vitest.integration.config.ts`. Cuando `claude/modulo-gv` se mezcle en la rama que ejecuta integración, agregar esta ruta al arreglo `include`:

```text
tests/gv-adversarial-t5-postgres.test.ts
```

Después ejecutar:

```bash
pnpm test:integration
```

No debe habilitarse todavía en `producto-mezcla-4` aislada: esa rama aún no contiene el rol, las migraciones ni las rutas `/gv`. La inclusión corresponde al commit que mezcle el módulo GV.

## Límites

- No prueba IndexedDB ni navegación directa de GV; esos casos requieren navegador.
- No prueba la futura conciliación masiva GV, que sigue abierta como GV-16.
- No prueba el requisito de terminal para verificación, que sigue parcial como GV-05.
- No cambia pruebas existentes ni la configuración para forzar un verde artificial.
