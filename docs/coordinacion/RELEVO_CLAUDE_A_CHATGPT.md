# Relevo de Claude a ChatGPT (10 oct 2026)

Claude se queda sin cupo de uso hasta el lunes. Mientras tanto, la dueña trabaja contigo.
Este archivo es TODO el contexto. Léelo completo antes de actuar. Las órdenes de siempre
siguen en `INSTRUCCIONES_ACTUALES.md` (secciones 3f–3m).

## 1. Reglas que no cambian
- Rama de trabajo tuya: `nexora-chatgpt-fase2`. Nunca empujes a `nexora-cloud` ni a `claude/*` de otros.
- Jamás despliegas. Jamás pegas contraseñas, tokens ni claves en chat, código o documentos.
- No reportes «listo» hasta que CI esté en verde en el ÚLTIMO SHA de tu rama (los tres trabajos: `verify`, `windows-installer`, `render-images`). Verde local no cuenta.
- No relajes, saltes ni borres pruebas para ponerlas en verde. Una prueba fallida es un hallazgo.
- Pruebas con fechas fijas cercanas a «hoy» son bombas de tiempo (hoy rompió el CI): usa fechas relativas.
- Producción es solo de la dueña y de Claude. La base de datos está cerrada a internet; no intentes conectarte.

## 2. Qué es esto
Nexora POS: punto de venta en la nube de la tienda de la dueña (Grupo Macgen, Santo Domingo). Es su fuente principal de ventas: no debe caerse.
Monorepo pnpm: `apps/api` (NestJS + Prisma + PostgreSQL 17), `apps/web` (React 19 PWA con cola sin conexión), `tests/` (vitest + Playwright), `deploy/render/`, `instalador/` (Windows, tuyo).
Render: API `srv-db3fep59fdbs73dic6n0` (privada, plan 1c-2g), web `srv-db3feel9fdbs73diarn0` (pública `https://nexora-pos-web.onrender.com`, 0.5c-512mb), base `dpg-db3feel9fdbs73dias9g-a` (0.5c-1g, disco 5 GB). Rama de despliegue: `nexora-cloud`.

## 3. Estado en producción (verificado 10 oct 14:00 UTC)
API y web corren el commit **a12c980** (= `claude/wave2`, ya mezclado en `nexora-cloud`). 7 migraciones nuevas aplicadas sin avisos. `/api/health` → `{"status":"ok"}`.
Incluye: respaldo cifrado a Google Drive (código listo, NO conectado), bloqueo de login por IP/dispositivo, PIN de 6 dígitos, índices de rendimiento, idempotencia de dinero, cola de escaneo, actualización PWA en modo aviso, retención/anonimización de datos.

## 4. Auditorías
Reportes completos en `docs/coordinacion/auditoria-2026-10-10/`: `01..07-*.md` (primera auditoría) y `*-v2.md` (segunda, sobre a12c980).
Segunda auditoría: 0 críticos. 1 ALTO nuevo (interbloqueo por la FK `CreditNote_customerId_fkey`, regresión de anoche) y varios MEDIOS. La auditoría de calidad (`07-calidad.md`) quedó parcial.

## 5. Trabajo en curso de Claude (ramas con correcciones de la auditoría v2)
Cuatro agentes de Claude corrigen, cada uno en su rama desde `nexora-cloud@a12c980`:
| Rama | Contenido |
|---|---|
| `claude/w3-datos` | Interbloqueo devolución↔venta (ALTO), venta descartada que reaparece, 503/409 en vez de 500, migración que valida restricciones, comprobaciones post-despliegue |
| `claude/w3-dinero` | Devolución a proveedor sin rastro, esquive del umbral de PIN, devolución en efectivo con transferencia pendiente, informe de pagos, alertas |
| `claude/w3-seg` | Cupo de bloqueo de login, CIDR de confianza en nginx, clave de respaldo con entropía, contraseñas temporales, privacidad del PDF del recibo, retención |
| `claude/w3-web` | Error de escaneo pegado al cobro, bloqueo por inactividad con carrito, borrador del carrito que resucita ventas |
Si alguna rama no existe aún o su CI no está en verde, Claude no terminó: NO la mezcles tú a `nexora-cloud`. Tu trabajo es revisarla (ver §6).

## 6. Qué haces tú, en este orden
1. **Revisa cada rama `claude/w3-*`** que exista: lee el diff, ejecuta `pnpm check` y sus pruebas, confirma CI verde del último SHA. Reporta a la dueña hallazgos concretos (archivo:línea). Si una rama tiene bug pequeño y claro, corrígelo en un commit sobre ESA rama solo si la dueña lo autoriza; si no, repórtalo.
2. **Integración** (cuando las cuatro estén revisadas y en verde): crea `claude/wave3` desde `nexora-cloud`, mezcla las cuatro (ojo: `sales.ts` lo tocan `w3-datos`, `w3-dinero` y `w3-seg`; resuelve conservando ambos lados), arregla migraciones con prefijo único y posterior a `202610210004`, y exige CI verde (los 3 trabajos) en el SHA final. Entrégale a la dueña el SHA.
3. **Segundo lote de tareas tuyas:** lo de 3k (documentos legales) y 3l (instalador: A1, A2, M1–M3, B1–B4), si aún no están hechos.
4. Cosas que NO puedes hacer y se dejan para Claude el lunes: desplegar, tocar Render, cambiar planes, auditorías nuevas completas.

## 7. Cómo se despliega (lo hace la dueña desde el panel de Render, o Claude cuando vuelva)
Solo con CI verde. Primero la API (`srv-db3fep59fdbs73dic6n0`), esperar «Live», revisar el registro del pre-despliegue (migraciones «successfully applied», sin errores), comprobar `/api/health`; después la web (`srv-db3feel9fdbs73diarn0`). Las cajeras verán un aviso de recarga una vez: es normal.

## 8. Lo que la dueña tiene pendiente (no es tuyo, pero ayúdala a entenderlo)
- Cerrar las dos cajas abiertas (AAD4 y Caja1@nexora.local) con conteo real.
- Cambiar su contraseña de administradora desde «Cambiar mi contraseña» (la anterior quedó expuesta).
- Avisar a las 4 cajeras que eligen contraseña nueva en su primer ingreso.
- Probar ticket en la impresora térmica y una venta con lector de códigos.
- Activar Autoscaling del disco de la base y revisar la pestaña Recovery/respaldos en Render.
- **Conectar el respaldo diario a su Drive** (lo más importante: hoy la única copia es la de Render, ventana de 3 días). Pasos en `docs/RESPALDO_DRIVE.md`: proyecto en Google Cloud, Drive API, pantalla de consentimiento «En producción», credenciales web con la URI de redirección, variables `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` y `BACKUP_ENCRYPTION_KEY` (≥32 caracteres, guardada también fuera de Render) en Render, botón «Conectar» y «Respaldar ahora». Los secretos van directo en Render, nunca en el chat.
- Bot de Telegram (@BotFather) y variables `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` en Render.
- Revisar tasas de incentivos (suplementos y fajas RD$50, maquillaje RD$25, mayoreo la mitad).
- Preguntar al contador por e-CF (plazo 15/11/2026) y comprobante fiscal; los tickets dicen «DOCUMENTO NO FISCAL». Preguntas listas en `docs/fiscal/PREGUNTAS_CONTADOR.md` (tarea 3k).
- Decidir «Permitir ventas sin conexión», monitor externo sobre `/healthz/deep` (palabra clave `"status":"ok"`), y si el repositorio pasa a privado.
- Enviar el formulario del sistema viejo con productos para cargarlos.

## 9. Riesgos que conoces ahora
- La única copia de datos es Render (3 días) hasta conectar Drive.
- `render.yaml` Blueprint con Auto Sync podría revertir planes: verificar que coincida con los planes reales (API 1c-2g, base 0.5c-1g).
- Migraciones nuevas con restricciones `NOT VALID` si hay datos viejos que las violen; `w3-datos` trae la validación.
- Hardware sin probar en tienda (impresora, lector).

## 10. Tono con la dueña
Habla español claro y sin tecnicismos. Dile primero qué falta y qué le toca a ella. Una cosa a la vez. Nunca le pidas contraseñas.
