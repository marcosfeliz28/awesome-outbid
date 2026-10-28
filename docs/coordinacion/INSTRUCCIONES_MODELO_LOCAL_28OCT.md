# Instrucciones: modelo local (Ollama) para seguir construyendo (28-oct, orden de la dueña)

**Quién lo usa:** Claude PC, en la laptop de Marcos. Nexora 1 (en la nube) no tiene acceso a Ollama de esa PC: Nexora 1 **define la cola y revisa**; Claude PC **ejecuta y verifica**.

## Qué hay
- Modelo: `deepseek-r1:latest` (7 mil millones de parámetros, 5,2 GB), en Ollama 0.40.12, en `http://127.0.0.1:11434`. Sin costo de API; tarda minutos por tarea.
- Script: `scripts/ollama-local/tarea.mjs` (rama `claude-pc/cola2-26oct`). Uso:
  `node scripts/ollama-local/tarea.mjs <encargo.md> docs/<salida>.md [--max-tokens=N] [--dry-run]`
  Solo escribe dentro de `docs/`. Quita el razonamiento del modelo.

## Reglas
1. **Tareas pequeñas:** un documento o una función pura por encargo. No pedir el rediseño completo de una vez.
2. **Encargo sin datos sensibles:** nada de claves, contraseñas, variables de entorno ni datos de clientes. Puede leer documentos y nombres de archivos del repo.
3. **Nada de código del proyecto sin revisión:** cada salida se revisa antes de usarse. Para funciones, prueba automática que falle antes y pase después.
4. **Verificación obligatoria:** comandos citados contra `package.json`; cifras contra su fuente; `[FALTA INFORMACIÓN]` cuando no se pueda confirmar.
5. **No tocar:** `App.tsx`, `styles.css`, dinero/DGII/NCF, migraciones, CI, instalador, `producto-nexora`, `nexora-cloud`.
6. **Salidas:** en `docs/` de una rama `claude-pc/*`; el borrador se marca «sin revisar» hasta que Claude PC lo revisa.

## Cola inicial (orden)
1. **D7 · guía de instalación para PC** (`docs/instalacion/INSTALACION_PC.md`): encargo en `docs/coordinacion/PARA_DEEPSEEK_WEB.md` (prompt completo con los scripts reales). Borrador previo en `BORRADOR_D7_LOCAL_SIN_REVISAR.md`: corregir `pnpm instalador:...` (hoy aparece como PowerShell).
2. **D8 · referencia de API**: solo nombres de rutas de `apps/api/src`, sin implementación.
3. **D16 · código muerto**: lista de candidatos con su motivo; sin borrar nada.
4. **D19 y D20 · informes de rendimiento y seguridad en lectura**: solo sobre documentos ya existentes; sin cifras inventadas.
5. **D24 y D25 · tildes rotas y restos de marca**: lista de hallazgos, sin cambios en código.

## Qué informa Claude PC a Nexora 1
Por cada tarea: rama, commit, resultado de la verificación y si quedó `[FALTA INFORMACIÓN]`. Solo LISTA cuando haya CI en verde.
