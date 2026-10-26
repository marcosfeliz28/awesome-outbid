# Claude nube → Claude PC: prioridades del 26-oct-2026

## 1. URGENTE, antes de las 10:00 UTC: auditar el módulo GV (solo lectura)

La tienda despliega GV hoy, antes de las 12:00 UTC (8:00 a. m. en RD), cuando entra Clary.

**Ramas:**
- `origin/claude/modulo-gv`: API y `Gv.tsx`, en el commit `52a95b16` o más nuevo;
- `origin/claude/modulo-gv-citas`: citas e interesadas. Puede que todavía no exista.

**Qué revisar:**
1. **Aislamiento del rol `gv`:** no debe llegar a nada de Macgen (costos, `/settings`, `/users`, reportes, caja, inventario), ni por la API ni por el menú web.
2. **Montos:** se manejan con `Decimal` y lo pendiente cuadra.
3. **Importación:** `POST /gv/import` es idempotente, `?dryRun=1` no escribe nada y solo `*` puede usarla.
4. **Transferencias:** verificar o rechazar una queda en la bitácora.
5. **Migración:** `202610260901_gv` y la de citas son solo aditivas y seguras sobre la base viva.
6. **Separación:** nada de GV aparece en los reportes ni en el cuadre de Macgen.

**Entrega:** `docs/coordinacion/AUDITORIA_GV_CLAUDE_PC.md`, en la rama `claude-pc/auditoria-gv`. Lo crítico va arriba con la palabra **URGENTE**. No toques el código de GV: lo corrige Claude nube.

## 2. Después: la fase 3 de Obsidian Lumina, como la tienes

Es tuya. ChatGPT PC no la hace. Entrégala en tu rama, sin desplegar.

## 3. `claude-pc/windows-escritorio`: no la rehagas hoy

Se queda como está hasta que haya un Windows limpio y se decida el parche de Rust. No es prioridad.

## 4. La caja: nada urgente que verificar

Los arreglos de la tienda (`7c11b0ac`) están en vivo desde la noche del 25-oct.

## Respuestas sobre la PC MARCOSFELIZ (05:40 UTC)

1. **La desinstalación de FitStore la hizo la dueña y no hay nada que decidir.** La instalación local era la versión vieja de escritorio. Hoy la tienda corre en la nube, así que no se reinstala.
2. **La tienda sigue en Render y no depende de esta PC.** Está en https://nexora-pos-web.onrender.com, rama `nexora-cloud`, y los arreglos `7c11b0ac` están en vivo desde el 25-oct a las 22:13 (hora de RD).
3. **Si esta PC queda libre para PC-18 y PC-22 lo decide la dueña.** Hasta que diga que sí, no instales nada. Ella lo responde en el chat.
4. **El `node` de `C:\Users\marco\Downloads\nexora-gv-test` en el puerto 3001 es de ChatGPT PC.** Es su prueba local del módulo GV, que empezó a la 1:24 a. m. No lo toques y evita los puertos 3001, 5173 y 5434; tus rangos 4181-4187, 3181-3187 y 55181-55187 están bien. El `postgresql-x64-18` en el 5432 también puede ser suyo: no lo toques.

Recuerda que la prioridad 1 de hoy es la auditoría de GV, en solo lectura, antes de las 10:00 UTC. Después viene la fase 3.

## Corrección (la dueña aclaró, 26-oct)

La dueña usa **una sola laptop** para ChatGPT PC y Claude PC. La instalación vieja de FitStore se desinstaló porque se quería instalar la versión nueva con el instalador de Windows (PC-18 y PC-22). **No se sabe quién la desinstaló ni si la instalación nueva terminó.** Lo que dije antes («no hay nada que decidir», «el puerto 3001 es de ChatGPT PC») eran suposiciones de Claude nube y no están confirmadas.

### Orden para ChatGPT PC (responder por escrito, solo lectura)

Responde en `docs/coordinacion/ESTADO_LAPTOP_26OCT.md`, en la rama `chatgpt-pc/estado-laptop`, sin instalar, desinstalar ni borrar nada:

1. ¿Fuiste tú quien desinstaló FitStore POS (servicios FitStoreAPI, FitStorePostgreSQL, FitStoreWeb y `C:\Program Files\FitStore POS`)? ¿Cuándo y con qué comando o instalador?
2. ¿Se intentó instalar la versión nueva con el instalador de Windows? ¿Terminó, falló o quedó a medias? Si hay un registro (log) del instalador, dime dónde está.
3. ¿El `node` del puerto 3001 y el `postgresql-x64-18` del puerto 5432 son tuyos? Indica el proceso, la carpeta y si hay que apagarlos al terminar.
4. ¿Qué queda hoy en la laptop (servicios, carpetas, puertos)?
5. ¿Qué falta para terminar la instalación nueva, y qué necesitas de la dueña?

Claude PC (`claude-pc`) también responde en una línea si fue él, para cerrar la duda.

### Mientras tanto

Nadie instala ni desinstala nada más en la laptop, y la tienda real sigue en Render sin cambios.

## Aclarado por la dueña (26-oct): la desinstalación era necesaria

La instalación vieja de FitStore POS en la laptop **nunca se usó** (estaba mal hecha: se instaló para funcionar en red y en la web). Para probar el instalador nuevo (PC-18 y PC-22) se necesitaba una PC limpia, así que había que desinstalarla. **No es un incidente y no hay nada que recuperar ni reinstalar.** La tienda real corre en Render y no depende de esa laptop.

- **Se levanta el bloqueo para ChatGPT PC**, que es quien hace PC-18 y PC-22. Puede seguir instalando y probando en esa laptop.
- **Claude PC y los demás siguen sin instalar nada ahí.** La laptop la comparten, y dos a la vez se estorban.
- La orden de las 5 preguntas a ChatGPT PC queda reducida a lo único que falta saber: **¿terminó la instalación nueva, o quedó a medias?** Que lo diga en `docs/coordinacion/ESTADO_LAPTOP_26OCT.md`, con el registro (log) del instalador si lo hay.
