# Dictamen del Revisor sobre el reparto local (`REPARTO_LOCAL_PC.md`, 734036bc) — 30-oct-2026

**Veredicto: confirmado, con 5 correcciones.** Nada cambia producción ni ramas de producto. Para pegar o citar en `docs/coordinacion/COLA_LOTE_LOCAL.md` (es la cola de Nexora 1; yo no escribo ahí).

## Quién es quién (según `COLA_FORJA.md` y `RESPUESTA_CLAUDE_PC_27OCT.md` §40)
- **Forja** = `qwen2.5-coder:14b`, manejado por Norexos PC: código pequeño y puro con prueba.
- **Brazo** = `deepseek-r1`: documentos y borradores.
- **Claude PC** revisa toda salida antes de subir (punto único de control: correcto).

## Reparto de bloques que propongo (Nexora 1 decide)
| Bloques de `COLA_LOTE_LOCAL.md` | Quién | Nota |
|---|---|---|
| 2 (movimiento), funciones puras | **Forja** (`qwen2.5-coder:14b`) | Con prueba que falle antes y pase después; solo funciones puras. |
| 3 (documentación), 4 (i18n ES/EN), 5 (marca, lectura) | **Brazo** (`deepseek-r1`) | Borrador «sin verificar»; Brazo **no escribe código** (una vez inventó una función). |
| 7, 8, 10, 14 y las tandas M/S de solo lectura (listados, conteos, mapas) | **Por script** (`grep`/`ls`/`wc`); el modelo, solo para la prosa | Lo mecánico lo hace un script, como el bloque 14; así el conteo no depende de la memoria del modelo. |
| 9 (construcción) | **Nadie por ahora** | Sigue «NO EJECUTAR» hasta el dictamen de Claude PC. |
| Redacción corta (≤4000 caracteres de entrada) | `qwen-optimizado` | Con el cierre «Qué hice / Qué NO comprobé». |
| Tablas y listas cortas | `qwen2.5-coder:7b` | Revisar siempre el cierre. |

## Correcciones
1. **Lo mecánico va por script, no por modelo.** Los conteos, listados y mapas se generan con `grep`/`ls`/`wc`; el modelo solo redacta alrededor. Evita los dos fallos vistos (alcance parcial presentado como completo, función inventada).
2. **Nada de lo que produce un modelo local se da por verificado.** Todo lleva «Borrador sin verificar», lista de archivos revisados y «PARCIAL» cuando no cubre todo; Claude PC lo contrasta con un comando antes de subirlo.
3. **Prueba del 30-oct (20/21 vs 18/21):** me parece correcto quedarse con la versión anterior del SYSTEM. Añade a la prueba una comprobación explícita de que **no aparece «DGII», «NCF» ni «e-CF» como funcionalidad** (el fallo de la versión revisada) y que no hay dinero ni credenciales.
4. **Reglas de entrada:** además de trocear a 4000 caracteres, **nunca entra al modelo** contenido de `docs/operacion`, `docs/legal`, `docs/seguridad`, `.env*`, `*.csv|*.xlsx|*.jsonl` ni los tests con contraseñas literales.
5. **Salida:** siempre `docs/` (idealmente `docs/diseno/borradores-local/`), nunca en las ramas de producto, nunca en las áreas de arriba; la rama la crea y empuja Claude PC, no el modelo.

## Lo que sigue exigiendo la orden de la dueña
Instalar modelos o herramientas nuevas, dar al modelo red, credenciales o permisos de escritura fuera de `docs/`, y cualquier tarea de dinero o mercancía. La autorización permanente de `docs/seguridad/AUTORIZACION-PERMANENTE-COLA-LOCAL.md` solo cubre tareas de solo lectura con salida en `docs/`.
