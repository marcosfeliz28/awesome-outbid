# Reparto general de trabajo — 1-nov-2026 (Norexos 1, cerebro)

Orden de la dueña: usar a TODOS a la vez, sin pisarse. Cada quien tiene sus archivos. Norexos 1 audita, mezcla y despliega; nadie más despliega ni mezcla en `nexora-cloud`. Lo que cada uno deja pendiente de revisar se anota en su archivo de resultados; Norexos 1 lo lee en cada ronda.

## Dueños de archivos (anti-colisión)
| Zona | Dueño | Los demás |
|---|---|---|
| `apps/web/src/App.tsx`, `styles.css`, `packages/ui`, animación, activos de marca | **ChatGPT** (pasa a ser el dueño; DeepSeek deja de serlo hoy) | solo leen; piden cambios por su archivo de resultados |
| `apps/api/**`, migraciones, `tests/` de dinero, GV (cierre, rol lectura), parches `pq-*` | **Claude PC** | no tocar |
| CI de `nexora-cloud`, mezcla, despliegue, cajas, auditoría de ramas | **Norexos 1** | no tocar |
| Documentos nuevos, borradores, pruebas pequeñas aisladas, `docs/diseno/borradores-local` | **IA local (DeepSeek, Qwen)** | — |
| Pruebas de uso en vivo y auditoría visual | **Gemini** | — |

## Por actor (órdenes concretas)
**ChatGPT nube** → `ORDEN_CHATGPT_CONSTRUCTOR_1NOV.md`: pieza 1 (verificar pendientes), pieza 2 (auditar mis 7 días), CI de `lumina-adentro-b`, `qa-medios`, `f1-01-bundle`, preparar `ventas-ciego` sin mezclar. Resultados: `RESULTADOS_CHATGPT.md`.
**ChatGPT PC** → mismo archivo: pieza 3 (modificaciones fuertes del sistema), pieza 4 (imágenes y activos), pieza 5 (animación futurista y dura). Una pieza a la vez.
**Claude PC** → `RESPUESTA_CLAUDE_PC_27OCT.md` órdenes 99 a 108 y `COLA_PERMANENTE_CLAUDE_PC.md`; cierre propio de GV (106), rol lectura (107), prueba de acceso (108), `pq-*`. No parar nunca.
**Claude nube (agentes baratos, Haiku)** → cada uno en su rama: el del CI rojo (`fix-ci-mes`, opción B2, en curso); `gv-incentivos`, `fix-dinero`, `fix-seg-menor`, `anim-reportes` esperan CI verde para que Norexos 1 los audite y mezcle. Ninguno despliega.
**IA local en esta PC** (DeepSeek `deepseek-r1`, Qwen `qwen2.5-coder:14b`) → `COLA_LOTE_LOCAL.md` (bloques que sigan sin hacer) y borradores de documentos; todo sale «sin revisar»; nunca `App.tsx` ni `styles.css`.
**Gemini** → `ORDEN_GEMINI_PRUEBA_VIVO.md`: recorrer la tienda como persona real tras el próximo despliegue, solo en la empresa de pruebas, ritmo humano; informe con capturas en `docs/auditoria/`. Credenciales las da la dueña por chat y no se escriben en ningún archivo.

## Reglas comunes
- Una rama por pieza, prueba que falle antes y pase después, 3 CI verdes del último SHA (`verify`, `windows-installer`, `render-images`) antes de decir «listo».
- Sin credenciales en archivos. Reglas de dinero de siempre: margen sin restar ITBIS, mínimo 15 %, no cambiar precios.
- Modo barato y lento pero constante: una pieza a la vez por actor, modelo más barato que alcance, sin repetir CI sin cambios.
- Orden de mezcla (decide Norexos 1): 1) arreglo del CI, 2) incentivos GV, 3) dinero y seguridad, 4) animación y diseño de ChatGPT, 5) `pq-*`.
