# Baja de cliente: exportar, bloquear y suprimir

Procedimiento para cuando una empresa (una sucursal, `branchId`) termina su
contrato. Lo ejecuta **solo Claude (nube) o la persona administradora del
servidor**, con el comando de administración; **no hay botón ni endpoint**. Se
corre desde una copia del repositorio con `DATABASE_URL` de la base que
corresponde (Render u otra). Detalle técnico: `docs/sistema/BAJA_DE_CLIENTE.md`.

Cumple la cláusula de terminación del contrato (auditoría del contrato,
7-nov-2026, punto 3): «exportación, bloqueo y supresión a los 30/60 días».

## Decisiones de la dueña (9-nov-2026)

1. **Plazo: 30 días** desde «terminar» hasta «suprimir» (`BAJA_DIAS_MINIMOS=30`,
   el valor por defecto del comando).
2. **Guardar todo.** Antes de suprimir, el paquete cifrado completo (todas las
   tablas de la sucursal) se conserva **10 años** fuera del servidor, junto con
   el acta. La base de datos sí se suprime; lo que queda es el paquete.
3. **Respaldos (rotación real, `apps/api/src/drive-backup-core.ts`,
   `retentionPlan`):** cada respaldo de Drive es la base completa y se guardan
   365 diarios + 1 por mes durante 120 meses (orden de la dueña del 20-oct:
   «que nada se pierda en 10 años»). Por eso los datos de un cliente dado de
   baja siguen dentro de los respaldos tomados antes de la supresión hasta 10
   años. El contrato debe decirlo así; no se borran de los respaldos uno por uno.
4. **Entrega (confirmada 9-nov):** el cliente recibe una copia del paquete
   (carpeta) y la clave por otro canal (llamada o WhatsApp), nunca juntas.
   Norexos guarda su copia del paquete y la clave en un lugar seguro 10 años.

## Antes de empezar

- Confirma con la dueña, por escrito, **qué sucursal** (`branchId`) se da de
  baja. La de la dueña (`main`) está **protegida en el código**: ninguna
  operación la toca. `BAJA_SUCURSALES_PROTEGIDAS` (lista con comas) agrega
  otras protegidas; no puede quitar `main`.
- Mira el estado y los conteos (solo lee):

```bash
cd apps/api
pnpm baja estado --sucursal <branchId>
```

## Paso 1 · Terminar (bloquear el ingreso)

```bash
pnpm baja terminar --sucursal <branchId>
```

Deja todos los usuarios de esa sucursal inactivos (las sesiones abiertas se
cortan en la siguiente petición), borra sus tokens y sesiones y revoca sus
terminales. Guarda la fecha de terminación. Repetirlo no cambia la fecha.

## Paso 2 · Exportar (paquete cifrado)

```bash
export BAJA_CLAVE="$(node -e 'console.log(require("crypto").randomBytes(32).toString("base64"))')"
pnpm baja exportar --sucursal <branchId> --salida /ruta/segura/baja-<branchId>-AAAA-MM-DD
```

- Crea un `<Tabla>.jsonl.enc` por tabla (una fila JSON por línea, cifrado
  AES-256-GCM) y `manifiesto.json` en claro con tablas, filas y SHA-256 del
  contenido y del archivo cifrado (sin datos personales). Imprime el SHA-256
  del manifiesto: anótalo.
- El cliente recibe sus **datos de negocio, no credenciales**: el paquete no
  lleva contraseñas ni PIN (`passwordHash`, `pinHash`), hashes de tokens ni
  secretos de terminales o de Drive (lista `SENSIBLES` en `baja.ts`). Esas
  columnas sí se borran al suprimir.
- `BAJA_CLAVE` debe tener 32 caracteres o más y no ser simple. **No la
  imprimas ni la pegues en chats.** Entrégala por un canal distinto del
  paquete.
- La exportación debe hacerse **después** de terminar; si se hizo antes, se
  repite (en una carpeta nueva). El paso 3 lo exige.
- Para abrir un archivo: `pnpm baja descifrar --archivo Sale.jsonl.enc --salida Sale.jsonl`
  (con la misma `BAJA_CLAVE`).
- Comprueba: cada archivo descifrado tiene tantas líneas como dice el
  manifiesto.

## Paso 3 · Suprimir (con confirmación doble escrita y fecha)

Pasados los 30 días, guardado el paquete (decisión 2) y solo con la
confirmación de la dueña:

```bash
BAJA_CLAVE=<la del paquete> \
  pnpm baja suprimir --sucursal <branchId> --paquete /ruta/segura/baja-<branchId>-AAAA-MM-DD --acta /ruta/segura/acta-<branchId>.json
```

- El comando **pregunta en la consola** y una persona escribe la frase exacta
  `SUPRIMIR <branchId>` y luego la fecha de hoy (zona de Santo Domingo). Sin
  consola (un script, una tubería) se niega. Si algo no coincide, no hace nada.
- Piso fijo de **30 días** desde terminar, en el código. `BAJA_DIAS_MINIMOS`
  solo lo sube (p. ej. 60); un valor menor se ignora.
- Exige la exportación hecha después de terminar y **abre el paquete**: el
  manifiesto debe ser el registrado, cada archivo debe tener su SHA-256 y
  abrirse con la clave, con las filas del manifiesto. Si falta un archivo,
  está dañado o la clave es otra, no borra nada.
- Dentro de la misma transacción compara las filas actuales con las del
  paquete, y después las borradas: si entró algo después de exportar, no borra
  nada y pide exportar de nuevo.
- Antes de borrar comprueba que ninguna fila de **otra** sucursal apunta a
  ésta ni al revés; si hay, se detiene sin borrar nada y dice dónde.
- Todo ocurre en una transacción: o se borra todo lo de la sucursal o nada.
- Escribe el **acta de supresión** (JSON sin datos personales: fechas, SHA-256
  del paquete, filas borradas por tabla) y la guarda, con su SHA-256, en la
  base (`BranchTermination`). Repetir el comando no borra nada y devuelve la
  misma acta. Si después de suprimir aparecen datos nuevos con ese mismo
  `branchId`, el comando se niega a borrarlos: hay que revisarlo a mano.
- No toca las tablas compartidas por todas las sucursales (roles, marcas,
  categorías de gasto, reglas de alerta) ni los intentos de ingreso, que la
  purga automática borra a los 2/30 días.

## Después

- `pnpm baja estado --sucursal <branchId>`: todas las filas en 0 y
  `suppressedAt` con fecha.
- Guarda el acta y el SHA-256 del paquete en el expediente del cliente.
- Anota en `docs/operacion/PENDIENTES-DUENA.md` que el cliente quedó dado de
  baja y la fecha.
