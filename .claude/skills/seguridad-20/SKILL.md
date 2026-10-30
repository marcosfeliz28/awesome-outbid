---
name: seguridad-20
description: Lista de 20 controles de seguridad que se aplican a TODO cambio y a la auditoría de las ramas antes de mezclar o desplegar (orden de la dueña, 30-oct-2026). Úsala al auditar un diff (Norexos 1), al construir endpoints, formularios, pantallas o dependencias, y cada semana en una auditoría completa (docs/auditoria/SEGURIDAD_20_PUNTOS.md).
---

# Seguridad en 20 puntos (Norexos)

Cómo se usa: al auditar un diff, recorre los puntos que apliquen y anota el resultado (OK / hallazgo archivo:línea / no aplica) en el mensaje del commit de mezcla o en `docs/auditoria/SEGURIDAD_20_PUNTOS.md`. Un hallazgo de nivel alto detiene la mezcla. Cada punto lleva «cómo se comprueba» en ESTE proyecto (API NestJS en apps/api/src, web en apps/web/src, Prisma/Postgres, Render, pnpm).

1. **Esconder llaves de API.** Ninguna llave (ANTHROPIC_API_KEY, Render, Drive, bancos) en el código, docs, capturas ni logs. `git grep -nE "sk-ant|BEGIN (RSA|PRIVATE)|api[_-]?key *[:=] *['\"][A-Za-z0-9]" ` y revisar `render.yaml`/`.env.example` solo con nombres, sin valores.
2. **Revisar variables de entorno.** Toda variable nueva se documenta en `.env.example` (nombre, sin valor) y `render.yaml`; la API falla al arrancar si falta una obligatoria; ninguna variable secreta llega al navegador (nada de `VITE_*` con secretos).
3. **Proteger rutas de administración.** Toda ruta `@Post/@Put/@Delete/@Patch` lleva `@Permit(...)`; las de solo administradores `@Permit("*")`. `node scripts/rutas-permisos.mjs` y revisar `docs/auditoria/RUTAS_Y_PERMISOS.md`: solo son públicas login, refresh, change-password, health y el retorno de Drive.
4. **Autenticación correcta.** Sesión/token con expiración, bloqueo por intentos (auth-lockout), PIN de gerente con límite de intentos, cambio de contraseña inicial obligatorio.
5. **Control de acceso por usuario (no solo por rol).** La cajera ve solo lo suyo (mySales), caja ciega hasta cerrar, costos/ganancia solo con `profit:read` y nunca la vendedora (`safe()` en common.ts). Filtrar EN EL SERVIDOR antes de responder. Probar con un usuario sin permiso: debe dar 403 o campos recortados.
6. **Sanitizar formularios.** Toda entrada con zod (tipos, largo máximo, formato); montos con `decimal`, nunca confiar en el cliente para precios/totales/descuentos; archivos subidos con tipo y tamaño validados (`imageType`).
7. **Protección XSS.** Nada de `dangerouslySetInnerHTML` ni `innerHTML` con datos de usuario; los textos de la IA y de clientes se muestran como texto. `git grep -n "dangerouslySetInnerHTML\|innerHTML"`.
8. **Límite de tasa.** Login, PIN, recuperación y la IA de ventas con límite (rate-limit.ts); la IA con tope diario por usuario.
9. **Asegurar endpoints de la API.** Cada endpoint valida permisos, entrada y pertenencia del recurso (sucursal/caja/venta del usuario); operaciones de dinero con `operationId` idempotente y auditoría (`audit`).
10. **CORS.** Orígenes permitidos explícitos (no `*` con credenciales); revisar la configuración en `app.ts`.
11. **Cabeceras de seguridad.** CSP, X-Content-Type-Options, X-Frame-Options/frame-ancestors, Referrer-Policy, HSTS en producción; comprobar con una petición a la web y a la API desplegadas.
12. **Modo debug apagado.** `NODE_ENV=production` en Render; sin stack traces ni mensajes internos al cliente; sin rutas de prueba habilitadas; logs sin datos personales ni montos de caja ciega.
13. **Dependencias al día.** `pnpm audit --prod` sin altas/críticas; actualizaciones con CI verde; lockfile fijo (`--frozen-lockfile`).
14. **Quitar paquetes sin usar.** Revisar con `pnpm exec depcheck` (o equivalente) antes de añadir; no añadir dependencia nueva sin justificarla en el commit.
15. **Archivos expuestos.** `apps/web/public` y el build no contienen `.env`, respaldos, `.git`, mapas de código con secretos ni documentos internos; probar rutas típicas (`/.env`, `/.git/config`, `/backup`).
16. **Base de datos segura.** Prisma con consultas parametrizadas (los `$queryRaw` solo con `Prisma.sql` y parámetros, nunca concatenar texto del usuario); migraciones aditivas y probadas desde cero; respaldos cifrados y su restauración probada; acceso externo cerrado (lista de IP vacía).
17. **Contraseñas con hash.** Solo hash (bcrypt/argon2) para contraseñas y PIN (`passwordHash`, `pinHash`); nunca registrar ni devolver hashes.
18. **Secretos filtrados en git.** Revisar historial y ramas: `git log -p -S"<patrón>"` y `git grep` en todas las ramas remotas; si aparece uno, rotarlo (no basta borrarlo).
19. **Auditoría completa.** Una vez por semana (o antes de una versión grande) una pasada de los 20 puntos con informe fechado en `docs/auditoria/SEGURIDAD_20_PUNTOS.md`; los hallazgos entran a `docs/coordinacion/PENDIENTES_NOCHE_30OCT.md` (o su sucesor).
20. **Sin errores («make no mistakes»).** Nunca afirmar «seguro» sin evidencia: cada punto con comando o prueba que lo respalde; lo no comprobado se escribe «NO COMPROBADO». Prueba automática para cada hallazgo corregido (primero falla, luego pasa).

## Dónde se aplica en el flujo
- **Auditoría de diff (Norexos 1):** antes de mezclar a nexora-cloud/producto-nexora recorre 3, 5, 6, 7, 9, 16 y 17 si hay código de API o web; 1, 2 y 18 siempre.
- **Obreros y sesiones:** cualquier tarea que toque endpoints, formularios, IA, permisos, dependencias o despliegue cita en su commit qué puntos revisó.
- **Despliegue:** además de las condiciones de `noche-autonoma`, comprobar 11, 12 y 15 en lo desplegado cuando cambie la configuración.
