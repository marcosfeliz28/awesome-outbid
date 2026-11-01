---
name: base-sistema
description: Base de conocimiento del sistema Norexos (docs/sistema/). Léela ANTES de preguntarle a la dueña o a otra sesión cómo funciona el sistema, y ACTUALÍZALA en el mismo cambio cada vez que algo del sistema cambie. Obligatorio para todas las sesiones.
---

# Base del sistema (docs/sistema/)

Orden de la dueña, 30-oct-2026: nadie le pregunta cómo funciona su sistema; se lee la base. Si la base no lo dice, se lee el código y se **agrega a la base**.

## Antes de preguntar (obligatorio)
1. Abre `docs/sistema/README.md` y `INDICE.json`; busca con `grep -rni "<tema>" docs/sistema`.
2. Si no está, búscalo en el código (`apps/web/src`, `apps/api/src`) y cita `archivo:línea`.
3. Solo si ni la base ni el código lo responden, pregunta a la dueña (una sola vez, todas las dudas juntas, y di qué ya revisaste). Los datos que solo ella decide (dominios, precios, montos, conteos) sí se le preguntan.

## Después de cambiar algo (obligatorio, mismo commit)
Cambió una pantalla, botón, flujo, permiso, regla de dinero, modelo, endpoint, texto de menú o rama/despliegue → en el MISMO commit:
1. Edita el archivo de `docs/sistema/` que corresponda (PANTALLAS, FLUJO_*, GV, ROLES_Y_PERMISOS, DATOS_Y_MODELOS, GLOSARIO).
2. Agrega una fila en `docs/sistema/CAMBIOS.md` (fecha, quién, qué, archivos).
3. Si añadiste un archivo, ponlo en `INDICE.json`.
Un cambio de sistema sin su línea en CAMBIOS.md no se mezcla ni se despliega (quien audita lo rechaza).

## Reglas de la base
- Todo dato lleva cita `archivo:línea` de la rama `nexora-cloud` (tienda). Lo del producto multiempresa va marcado «producto-nexora».
- Lo no desplegado se marca «aún no desplegado» y la rama.
- Nada inventado: «NO ENCONTRADO» si no se confirmó.
- Sin credenciales, claves ni datos de clientes.
- La base se copia a `producto-nexora` solo en lo que aplique allí.

## Citas y pre-empuje
- `pnpm docs:citas` mueve cada cita `archivo:línea` de `docs/sistema` a su línea nueva usando el fragmento guardado en `docs/sistema/CITAS_ANCLAS.json`; la prueba de citas también lo corre. Si una cita sale «PERDIDA», el código de esa línea desapareció: reescribe la frase. Sube el JSON con el cambio.
- `node scripts/pre-empuje.mjs` antes de empujar: marcadores de conflicto, citas, prettier/eslint de lo cambiado y typecheck (`--sin-typecheck` para omitirlo).
