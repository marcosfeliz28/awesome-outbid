# Nexora: guía breve para la dueña

10-oct-2026, código revisado `496030f`. Explica funciones disponibles; no confirma cuentas activas ni seguridad de producción. No guarde claves o datos de clientes en este documento.

## Dónde están los datos

**Render:** en la modalidad cloud, el servidor y PostgreSQL guardan ventas, inventario, clientes, usuarios y caja. El archivo de despliegue dice Virginia; quien administra Render debe confirmar la región y servicios reales (`render.yaml:15`, `:41`, `:77`; `apps/api/prisma/schema.prisma:216`).

**Google Drive:** existe respaldo completo cifrado antes de salir del servidor. Necesita configuración y conexión con su cuenta. El relevo dice que todavía no está conectado; no lo comprobamos en vivo. Siga `docs/RESPALDO_DRIVE.md`, conecte y pruebe **Respaldar ahora**. Solo entonces compruebe que hay un respaldo bueno. La frase está en la configuración del servidor: guárdela también fuera de Render y nunca la envíe por chat (`apps/api/src/drive-backup.ts:113`, `:627`, `:999`; `docs/coordinacion/RELEVO_CLAUDE_A_CHATGPT.md:22`, `:53`).

El código agenda desde las **03:30 hora Santo Domingo** cuando está configurado/conectado. Conserva una copia de cada uno de los 30 días más recientes **con respaldo** y una de cada uno de los 12 meses más recientes **con respaldo**. Las sobrantes van a papelera; desconectar deja copias existentes. Un periodo sin copias puede dejar archivos más viejos: «unos 13 meses» no es un máximo garantizado (`apps/api/src/drive-backup-core.ts:546`, `:602`; `apps/api/src/drive-backup.ts:1062`, `:1287`).

**Celular o laptop de la cajera:** el navegador guarda consultas y puede guardar ventas/entradas sin sincronizar. Cerrar sesión borra consultas recuperables, pero conserva operaciones pendientes o en conflicto para no perder dinero o mercancía. Bloquee el equipo y use una cuenta por persona (`apps/web/src/api.ts:281`, `:298`). Telegram, si se activa, también conserva mensajes con nombres e importes; revise quién accede al grupo (`apps/api/src/notifications.ts:191`, `:678`).

## Quién puede ver y hacer qué

El servidor manda según permisos: administración tiene acceso completo; gerencia tiene gestión y ganancias; venta tiene catálogo, ventas, caja y clientes; almacén tiene permisos de inventario/compras. Revise los roles reales de sus usuarias. No confunda el nombre «cajera» con un permiso automático (`packages/shared/src/index.ts:654`). Las fotos de pagos tienen control de acceso; no basta conocer el enlace (`apps/api/src/sales.ts:2150`).

Usuarios y restablecimiento de contraseña requieren administración. Revocar equipos requiere gestión de ventas; el respaldo Drive requiere administración. Esto no impide que una persona copie lo que ya pudo ver (`apps/api/src/admin.ts:1069`, `:1151`; `apps/api/src/realtime.ts:395`; `apps/api/src/drive-backup.ts:1401`).

## Si una cajera renuncia

1. Desde **Usuarios y permisos**, identifique a la persona y pulse **Desactivar**. Conserve su cuenta histórica; cree otra para la nueva empleada (`apps/web/src/Management.tsx:3607`, `:3725`).
2. La desactivación invalida sus sesiones y renovación; la API comprueba cuenta activa y versión vigente. No borra datos remotos del celular (`apps/api/src/admin.ts:1118`; `apps/api/src/common.ts:633`; `apps/web/src/api.ts:281`).
3. Si ya no corresponde el acceso del dispositivo, entre desde otro autorizado a **Equipos** y revoque el suyo. No puede revocar el equipo que usa en ese momento; se eliminan sus sesiones de servidor (`apps/web/src/Management.tsx:3609`; `apps/api/src/realtime.ts:395`).
4. Revise su caja abierta y operaciones pendientes antes de borrar/restablecer el equipo. Retire también su acceso a Telegram/Drive si lo tenía: revocar en Nexora no cambia miembros de otras cuentas (`apps/web/src/api.ts:286`; `apps/api/src/realtime.ts:395`).

## Si roban un equipo

Desde otro equipo, desactive la cuenta afectada, revoque el dispositivo y use **Restablecer contraseña** si sospecha exposición. Para cambiar acceso de su propia cuenta, necesita otra administración autorizada; la propia contraseña se cambia con «Cambiar mi contraseña». El restablecimiento invalida el acceso anterior y obliga a cambiar la temporal (`apps/web/src/Management.tsx:3706`; `apps/api/src/admin.ts:1090`, `:1151`, `:1181`).

La revocación bloquea solicitudes al servidor, **no borra el teléfono ni impide leer lo almacenado sin internet**. Use también las herramientas oficiales de bloqueo/borrado remoto del teléfono. Informe a gerencia de las operaciones pendientes; no vacíe una cola recuperable sin revisar sus cobros (`apps/api/src/common.ts:671`; `apps/web/src/api.ts:286`).

## Rutina de respaldos propuesta

**Cada día:** mire la tarjeta del respaldo y su último resultado bueno; **cada semana:** compruebe en su Drive la copia reciente y accesos de la cuenta; **cada mes:** pida una restauración de prueba en una base nueva descartable, nunca encima de la tienda. Es una rutina recomendada, no una automatización que hayamos confirmado. Si faltan copias, avise de inmediato. Telegram puede alertar de fallos o más de 36 h sin éxito, pero requiere estar activado; revise la tarjeta aunque no llegue aviso (`apps/api/src/drive-backup.ts:711`, `:1091`; `apps/api/src/drive-backup-core.ts:610`).

La verificación de subida comprueba tamaño/sumas y no reemplaza restaurar. El descifrador produce dump y comprobación de integridad; siga la guía con ayuda técnica y conserve copias/clave en lugares distintos. No pruebe restauración sobre producción (`apps/api/src/drive-backup.ts:999`; `scripts/decrypt-backup.mjs:86`, `:134`; `docs/RESPALDO_DRIVE.md:162`).
