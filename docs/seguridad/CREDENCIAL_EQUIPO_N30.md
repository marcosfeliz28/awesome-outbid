# N-30 · Credencial de equipo ligada al navegador

## Resultado del estudio

Hoy `apps/web/src/realtime.tsx` guarda `id`, nombre y secreto del equipo en
`localStorage`. La API guarda únicamente su hash y permite revocar el equipo y
sus sesiones. El riesgo pendiente es que cualquier JavaScript ejecutado en el
mismo origen puede leer el secreto y copiarlo.

**No se corrige cifrando el valor en `localStorage`:** la clave para descifrarlo
también quedaría disponible para ese mismo JavaScript. Una clave WebCrypto no
exportable reduce el robo del material en reposo, pero un XSS activo todavía
podría pedirle al navegador que firme mientras la página comprometida siga
abierta. Por eso esta medida complementa, no sustituye, CSP, sanitización,
revocación y sesiones breves.

## Diseño propuesto (no activado todavía)

1. El navegador crea con WebCrypto un par ECDSA P-256 no exportable. La clave
   privada queda en IndexedDB; el servidor recibe solo la clave pública.
2. Para iniciar sesión o registrar el equipo, la API entrega un desafío aleatorio
   de un solo uso, ligado a empresa, sucursal, equipo, propósito y vencimiento de
   dos minutos. El navegador firma exactamente esos campos.
3. La API consume el desafío atómicamente, verifica la firma y mantiene el mismo
   `terminalId`, aprobación, sucursal, bitácora, límites y revocación actuales.
4. Recuperar o cambiar de navegador crea una credencial nueva pendiente de
   aprobación. Nunca copia la clave privada ni reactiva un equipo revocado.

## Migración sin romper equipos aprobados

- Añadir campos opcionales `publicKeyJwk`, `credentialVersion` y
  `credentialRotatedAt`; no borrar `secretHash` en la migración inicial.
- Un equipo legado aprobado puede hacer **una** rotación autenticada. La API
  guarda la clave pública y, solo después de una firma de prueba válida, elimina
  su `secretHash` en la misma transacción y registra la rotación.
- Durante una versión de compatibilidad se aceptan `legacy-secret` o
  `webauthn-lite`, nunca ambos para el mismo equipo una vez rotado. No hay
  conversión automática silenciosa ni secreto de recuperación compartido.
- El cierre de compatibilidad requiere medir equipos legados restantes, avisar
  al dueño y ofrecer aprobación manual. La revocación actual elimina sesiones y
  bloquea ambas versiones inmediatamente.

## Pruebas obligatorias antes de programarlo

- Dos empresas no pueden verificar el mismo desafío, clave o `terminalId`.
- Repetir una firma, cambiar propósito/sucursal o usarla vencida devuelve 401.
- Dos rotaciones concurrentes dejan una sola clave pública y una sola bitácora.
- Un equipo revocado no inicia sesión con secreto legado ni firma nueva.
- Actualizar desde la PWA anterior conserva el equipo aprobado; recuperar el
  navegador exige aprobación nueva.
- Una prueba XSS demuestra el límite: el atacante no exporta la clave privada,
  pero puede invocar `sign()` mientras ejecuta código. La documentación y el
  modelo de amenaza no deben prometer protección total frente a XSS activo.

## Puerta de implementación

Esta entrega es el estudio pedido por N-30. No cambia credenciales ni producción.
La implementación se autoriza cuando existan migración aditiva, endpoint de
desafío idempotente, pruebas PostgreSQL multiempresa y ensayo de actualización
con un equipo legado aprobado. Hasta entonces se conserva la revocación actual.
