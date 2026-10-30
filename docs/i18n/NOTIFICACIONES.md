# Textos de notificaciones salientes (tarea 80)

Borrador sin verificar. Fuente: `origin/producto-nexora` (`415f602a`), rama `claude-pc/cola-b13`. **PARCIAL**: la búsqueda cubrió solo Telegram (`sendMessage`, `telegram`) y correo (`sendMail`, `sendEmail`) en `apps/api/src`; no se revisaron avisos de otras rutas.

| Texto | Archivo:línea | Dice Nexora o Norexos |
|---|---|---|
| Los avisos por Telegram no están activados: faltan TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID en el servidor. | `apps/api/src/notifications.ts:1058` | no |

Nota: el modelo local devolvió una tabla con líneas de código y una fila cortada; se descartó y esta versión sale de `grep -n` a mano.
