# Auditoría adversaria del lote de ChatGPT (`nexora-chatgpt-fase2`)

- **Rama auditada:** `origin/nexora-chatgpt-fase2` @ `662b474` (base de comparación: `origin/nexora-cloud` @ `56a7445`).
- **Commits:** U2 `73de6ac`, U-crédito `7213750`, P1 `5091a8f` + `c14585a`, P2 `f237e5c`, P3 `81d9f51`, P4 `e6fc291` + `62811f6`, P5 `9c758a7` + `7a1399d` + `662b474`, P6 `56ac7e4`. Todos los SHA existen.
- **Modo:** solo lectura. Se leyeron los diffs y se compararon con el código de `nexora-cloud`. Ejecutado (mínimo):
  - `pnpm --filter @fitstore/web typecheck` → **OK** (sin errores).
  - `vitest run` de los archivos tocados (`customer-display`, `management-messages`, `u-credit-cleanup`, `compliance`, `accessibility-contract`, `e2e-higiene`) → **52/52 OK**.
  - `eslint` de los archivos tocados → **OK**. `prettier --check` → los 3 avisos (`monitoring.ts`, `api.test.ts`, `offline-policy.test.ts`) ya existían; el lote no tocó esos archivos.
  - `vite build` de producción, para inspeccionar el bundle (U2).
  - Un script de Node que importa `apps/web/src/managementMessages.ts` y le pasa mensajes reales del servidor y del POS (P3).
  - No se corrieron suites completas ni e2e (eso lo hace el agente integrador). No se creó ninguna base PostgreSQL.
- **Leyenda:** **[V]** verificado (leído en código, ejecutado o comprobado en el bundle) · **[S]** sospecha (razonada, sin reproducir).

## Resumen de veredictos

| Commit                          | ID        | Veredicto                                 | Severidad máx. | Motivo principal                                                                                                                                               |
| ------------------------------- | --------- | ----------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `73de6ac`                       | U2        | **Aceptar** (requiere actualizar una e2e) | Media (CI)     | Correcto en producción; rompe `fuentes.spec.ts:437`, que hace clic en «Guía de estilos».                                                                       |
| `7213750`                       | U-crédito | **Aceptar**                               | Baja           | Ni la API ni la contraentrega usan `creditDueDate`; el método `credit` no se puede elegir en el POS.                                                           |
| `5091a8f`, `c14585a`            | P1        | **Aceptar** (mejora opcional)             | Baja           | Usa el endpoint correcto, aplica la misma política que el servidor y no se puede saltar.                                                                       |
| `f237e5c`                       | P2        | **Aceptar con cambios**                   | Baja           | Las afirmaciones coinciden con el código; «gerencia» es ambiguo para anular, abonos y Ajustes, que exigen `*` (administrador).                                 |
| `81d9f51`                       | P3        | **Rechazar en su forma actual**           | **Alta**       | El filtro en lista blanca oculta mensajes del lector de códigos, de caja y de dinero, y rompe al menos 11 aserciones e2e. Las ramas 401/403 nunca se ejecutan. |
| `e6fc291`, `62811f6`            | P4        | **Aceptar con cambios**                   | Baja           | El ticket y el cuadre están bien; el logo predeterminado no está precacheado y no se puede quitar.                                                             |
| `9c758a7`, `7a1399d`, `662b474` | P5        | **Aceptar con cambios**                   | Media          | El texto es prudente y no promete retención cero. El enmascarado se salta con «Editar», con el selector del POS y con la búsqueda.                             |
| `56ac7e4`                       | P6        | **Aceptar**                               | Baja           | No cambia JS de teclado: F2/F4/F8/F12, Enter del lector y el foco quedan igual.                                                                                |

**Bloqueante para mezclar:** P3. El resto se puede mezclar con los ajustes indicados. U2 necesita antes el cambio en la e2e, que según el protocolo hace Claude.

---

## U2 · `73de6ac` — identidad Nexora y guía de estilos solo en desarrollo

**Veredicto: Aceptar.** Antes de mezclar hay que actualizar la e2e (U2-1).

Comprobaciones:

- **[V] La guía no aparece en producción.** `SHOW_STYLE_GUIDE = import.meta.env.DEV` (`App.tsx:72`). En el bundle de `vite build`, el botón y la entrada `styles` del mapa de páginas ya no existen. Solo queda el literal del breadcrumb (`App.tsx:628`, `page === "styles" ? "Guía de estilos" : …`), que es inofensivo.
- **[V] `#styles` en producción redirige.** El efecto de `App.tsx:398-406` no excluye `styles` cuando `DEV` es falso y llama a `go(allowed[0])`. Antes del efecto hay un render donde `pages["styles"]` vale `undefined` y se usa `<Dashboard>` como respaldo. Es el mismo comportamiento que con cualquier hash desconocido, así que no es una regresión. `tests/u2-mobile.mjs:81-82` lo prueba contra una compilación de vista previa.
- **[V] Las demás rutas no cambian.** `settings` conserva su excepción.
- **[V] La «n» del banner no es una marca ajena.** Es la misma «n•» del logotipo de Nexora en la pantalla de acceso (`App.tsx:150-152`), como pide `INSTRUCCIONES_ACTUALES.md` §6a. La «f» de antes (FitStore) era la que recordaba a Facebook.
- **[V] La tarjeta de ayuda abre contenido útil.** Abre el modal con los atajos reales (F2/F4/F8/F12/F9/F7/F10/Ctrl+K) y el botón «Ir al punto de venta». El aviso sobre ventas sin internet («Si tu tienda permite…») coincide con `offlinePolicy.ts`, donde están bloqueadas por defecto.

### U2-1 · Media (CI) · La e2e de celular hace clic en «Guía de estilos», que ya no existe en la vista previa **[V]**

- `tests/e2e/fuentes.spec.ts:435-443`. Playwright corre contra `vite preview` (`playwright.config.ts`), que es una compilación de producción, así que `DEV` es falso y el botón no existe.
- **Reproducir:** `pnpm build && pnpm test:e2e -g "menú abierto queda por encima"`. Falla con _locator … getByRole('button', { name: 'Guía de estilos' }) … waiting_.
- **Diff mínimo** (la e2e es de Claude; según el protocolo, ChatGPT no la toca):

```diff
-    await page
-      .locator(".sidebar")
-      .getByRole("button", { name: "Guía de estilos", exact: true })
-      .click();
-    await expect(page.locator(".breadcrumb strong")).toHaveText(
-      "Guía de estilos",
-    );
-    await listo(page);
-    expect(await desbordes(page, "Guía de estilos @" + ancho)).toEqual([]);
+    const menu = page.locator(".sidebar");
+    await expect(
+      menu.getByRole("button", { name: "Guía de estilos", exact: true }),
+    ).toHaveCount(0);
+    // La última opción del menú (admin) es ahora Configuración.
+    await menu.getByRole("button", { name: "Configuración", exact: true }).click();
+    await expect(page.locator(".breadcrumb strong")).toHaveText("Configuración");
+    await listo(page);
+    expect(await desbordes(page, "Configuración @" + ancho)).toEqual([]);
```

### U2-2 · Baja · Literal muerto en el breadcrumb **[V]**

- `App.tsx:628`: en producción nunca se muestra. Se puede dejar como está o protegerlo con `SHOW_STYLE_GUIDE &&`. No requiere acción.

---

## U-crédito · `7213750` — quita el vencimiento inalcanzable

**Veredicto: Aceptar.**

- **[V] El método `credit` no se puede elegir en el POS.** La lista de métodos (`POS.tsx:1866-1872` en `nexora-cloud`) solo ofrece `cash/card/transfer/credit_note/cod`, y `setMethod` solo se llama desde esa lista (`POS.tsx:1877`). La única opción «Crédito» restante es el _tipo de tarjeta_ (`cardType`), que no tiene relación con esto.
- **[V] La API no cambia y la contraentrega no depende de la fecha.** `sales.ts:652` sigue exigiendo `creditDueDate` solo cuando hay pagos `method:"credit"`, que solo envían clientes de la API (pruebas `api.test.ts`, `store.spec.ts:1412`). La contraentrega (`cod`) nunca leyó `creditDueDate` (`sales.ts:614-649`), y el esquema compartido lo mantiene opcional (`packages/shared/src/index.ts:487`). Nada en la API espera el campo cuando se paga por contraentrega.
- **[V]** Ninguna e2e busca «Vencimiento del crédito» ni «Indica la fecha de vencimiento».

### UC-1 · Baja · El manual da a entender que el interruptor de Ajustes controla la contraentrega **[V]**

- `docs/MANUAL.md:143`: «El administrador puede habilitar **Ventas a crédito** en Ajustes. Selecciona el cliente y, al cobrar, selecciona **Crédito / contraentrega**…».
- En el código, `cod` funciona aunque `allowCreditSales` esté apagado. Lo que cambia con el interruptor es que la cajera necesita el PIN del gerente por **cualquier** monto (`receivableNeedsApproval`, `packages/shared/src/index.ts:389-405`). Además, `sales.ts:650` bloquea solo `credit`.
- **Diff mínimo:**

```diff
-El administrador puede habilitar **Ventas a crédito** en Ajustes. Selecciona el cliente y, al cobrar, selecciona **Crédito / contraentrega** …
+Selecciona el cliente y, al cobrar, elige **Crédito / contraentrega** e indica el monto pendiente; este método no pide fecha de vencimiento. Si **Ventas a crédito** está desactivado en Ajustes, o el monto supera el umbral de aprobación, el gerente debe escribir su PIN. …
```

---

## P1 · `5091a8f` + `c14585a` — cambio de contraseña obligatorio

**Veredicto: Aceptar.** P1-1 y P1-2 son mejoras opcionales.

- **[V] No se puede saltar.** El servidor no entrega token mientras `mustChangePassword` esté activo: `/auth/login` devuelve solo `{ requiresPasswordChange: true }` (`auth.ts:251`), y el guard rechaza a usuarios con `mustChangePassword` (`common.ts:542`). La interfaz solo cambia la presentación.
- **[V] Usa el endpoint correcto.** `POST /auth/change-password` con `{ login, currentPassword, newPassword, confirmPassword }`, el mismo contrato que `auth.ts:255-282`.
- **[V] No debilita la política.** `passwordChange.ts:2-10` replica `isStrongPassword` (`apps/api/src/password-policy.ts`): ≥12 caracteres, `\p{Lu}`, `\p{Ll}`, `\d` y `[\p{P}\p{S}]`, más ≤128 caracteres y ≤72 bytes UTF-8. La validación del cliente solo se suma a la del servidor, que sigue usando `strongPasswordSchema` y `isDifferentPassword`.
- **[V] La clave no se filtra.** No hay `console.*`. El `<form>` hace `preventDefault()` y los `<input>` no tienen `name`: aunque el JS no llegara a cargar, el GET no serializaría campos en la URL. Sentry tiene Replay con `maskAllInputs`, `networkCaptureBodies:false` y `networkDetailDenyUrls:[/.*/]` (`monitoring.ts:76-82`). Los mensajes de error son textos fijos.
- **[V] Funciona en móvil.** `autoComplete="new-password"`, `autoCapitalize="none"`, `spellCheck={false}`, `minLength`/`maxLength`, campos de 44 px, `aria-describedby` hacia las reglas y la fortaleza en `role="status"`. Las reglas muestran el texto «Cumplida/Pendiente», no solo un icono.
- **[V]** Una clave incorrecta devuelve 400 (`security.ts:119-120`, `bad`). Por eso `api()` no reintenta tras un 401 ni consume dos intentos.
- `c14585a` solo corrige el lint del script de captura (`globalThis.document`). Sin riesgo.

### P1-1 · Baja · El mensaje de cuenta bloqueada pierde la indicación útil **[V]**

- `passwordChange.ts:31`: el texto del servidor «Cuenta bloqueada temporalmente. Espera 15 minutos o pide a un administrador…» se convierte en «Espera un momento». La cajera ya no sabe cuánto esperar ni que gerencia puede asignarle otra clave temporal.
- **Diff mínimo:**

```diff
+  if (/bloquead/i.test(message))
+    return "Tu cuenta quedó bloqueada por intentos fallidos. Espera 15 minutos o pide a gerencia una clave temporal nueva.";
-  if (/demasiados|intentos|429|bloquead/i.test(message))
+  if (/demasiados|intentos|429/i.test(message))
```

### P1-2 · Baja · Sin botón para mostrar la clave **[S]**

- Escribir 12 caracteres con símbolos en un móvil, sin ver lo escrito, provoca errores de «no coinciden». Un botón «Mostrar» (`type` password↔text, con `aria-pressed`) reduciría bloqueos. Es opcional.

---

## P2 · `f237e5c` — manual de la cajera

**Veredicto: Aceptar con cambios** (P2-1, solo de texto).

Afirmaciones contrastadas con `nexora-cloud`:

| Afirmación del manual                                                                                                                                                                 | Código                                                                                                                                                                                                | Estado                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Un fondo menor al sugerido pide nota y PIN de gerente (§1.3)                                                                                                                          | `cash.ts:515-550`: compara con lo dejado en el último cierre, exige `openingNote` y, sin `sale:manage`, `managerPin`; la interfaz tiene «PIN de gerente si el fondo es menor» (`Management.tsx:1747`) | **[V] correcta**                                                                          |
| Contraentrega: «si pide PIN del gerente…» (§3.4)                                                                                                                                      | `receivableNeedsApproval`: PIN si `cod` supera el umbral o si `allowCreditSales` está apagado, para quien no tiene `sale:manage`                                                                      | **[V] correcta** (en condicional)                                                         |
| Un descuento por encima del límite pide motivo y PIN (§3.5)                                                                                                                           | `sales.ts:348` (`sellerDiscountLimit`), `sales.ts:451-452` (motivo)                                                                                                                                   | **[V] correcta**                                                                          |
| Salida de efectivo: PIN si las salidas acumuladas del turno superan el límite (§4.3)                                                                                                  | `cash.ts:651-691` suma todas las salidas del turno contra `cashMovementApprovalLimit` (1000 por defecto)                                                                                              | **[V] correcta**                                                                          |
| Cierre ciego: la cajera no ve lo esperado y los campos vacíos cuentan como RD$ 0.00 (§7)                                                                                              | `Tienda.tsx:83` (`""→0`), `:194-197` (aviso ciego), `:237-247` (tarjeta y transferencia `required`), `:267-273` (casilla), `cash.ts:95-96` (`?? 0`)                                                   | **[V] correcta**; corrige el error del manual anterior («se toma el monto esperado»)      |
| Anular: solo gerencia (§6)                                                                                                                                                            | `sales.ts:1154-1155` `@Permit("*")`: **solo administrador**. El rol `manager` no puede anular                                                                                                         | **[V] ambigua** → P2-1                                                                    |
| Devolución: la hace la «persona autorizada»; suplementos y maquillaje abiertos no vuelven al stock (§5)                                                                               | `sales.ts:1445` `sale:manage`; `:1527-1528` `opened && requiresLot`; en la semilla, `requiresLot` = Suplementos/Maquillaje (`seed.ts:443`)                                                            | **[V] correcta** (depende de la configuración de la categoría)                            |
| Reembolso en efectivo de una caja ya cerrada: hace falta caja propia abierta (§6.5)                                                                                                   | `sales.ts` (anulación, rama `originalCash?.closedAt`)                                                                                                                                                 | **[V] correcta**                                                                          |
| Ventas sin internet: desactivadas por defecto y «solo gerencia» puede activarlas (§8.1)                                                                                               | `admin.ts:81` `default(false)`; `PUT /settings` `@Permit("*")`                                                                                                                                        | **[V]** el valor por defecto es correcto; quien las activa es el **administrador** → P2-1 |
| Textos de la interfaz («Abrir mi caja», «Cerrar y arquear», «Tarjeta declarada», «Confirmo que conté…», «Nuevo cliente aquí mismo», «Ventas guardadas en este dispositivo», F4, F12…) | Todos existen en `apps/web/src`                                                                                                                                                                       | **[V]**                                                                                   |

### P2-1 · Baja · «Gerencia» no coincide con el rol `manager` del sistema **[V]**

- Anular (`sales.ts:1155`), registrar y verificar abonos (`sales.ts:1834`, `:1849`, `:1350`) y cambiar Ajustes (`admin.ts:598`) requieren `*` (administrador). El rol `manager` («gerente») tiene `sale:manage`, pero **no** `*` (`packages/shared/src/index.ts:632-650`).
- Si la cajera llama a un usuario con rol `manager`, este no verá «Anular» y pensará que es una falla.
- **Diff mínimo** (`docs/MANUAL-CAJERO.md`):

```diff
-## 6. Anular: solo gerencia
+## 6. Anular: solo administración (Marcos o Génesis)
@@
-5. Un descuento sobre tu autorización requiere motivo y PIN de gerente. No dividas facturas para evitar controles. Gerencia registra y verifica luego los abonos del crédito.
+5. Un descuento sobre tu autorización requiere motivo y PIN de gerente. No dividas facturas para evitar controles. Administración (Marcos o Génesis) registra y verifica luego los abonos del crédito.
@@
-1. Si aparece **Sin conexión** antes del cobro, espera En línea. Las ventas offline están desactivadas por defecto; solo gerencia puede habilitarlas y asumir revisión posterior.
+1. Si aparece **Sin conexión** antes del cobro, espera En línea. Las ventas offline están desactivadas por defecto; solo administración puede habilitarlas y asumir revisión posterior.
```

### P2-2 · Baja · Captura sin usar **[V]**

- `docs/capturas/manual/03-cobrar.png` no se referencia en el manual: la prueba exige exactamente 8 imágenes y hay 9 archivos. Se puede borrar o usar en §3.

### Fuera de alcance (ya existía, no lo introduce el lote) **[V]**

- `docs/legal/POLITICA_PRIVACIDAD.md:26` dice que se puede comprar como «consumidor final» sin dar nombre. El POS exige cliente antes de cobrar (`POS.tsx`, «Selecciona o crea el cliente antes de cobrar.»), y el manual anterior lo decía de forma explícita. Lo debe revisar el abogado o la dueña.

---

## P3 · `81d9f51` — mensajes claros y estados vacíos

**Veredicto: Rechazar en su forma actual.** Los textos de los estados vacíos (`DataTable empty/emptyDescription`) y los toasts fijos de descarga e importación se pueden aceptar. Lo que no se puede aceptar es el filtro de errores.

### P3-1 · **Alta** · El filtro en lista blanca oculta mensajes útiles, incluidos los del lector de códigos y los de dinero **[V]**

- `apps/web/src/managementMessages.ts:17` solo deja pasar los mensajes que empiezan por `Indica|Selecciona|…|La devolución`. Todo lo demás se cambia por «No pudimos completar la operación. Revisa los datos y tu conexión…».
- `apps/web/src/helpers.tsx:35-36` aplica ese filtro a **todos** los `toast(…, true)` de la aplicación, también a los que genera el propio cliente en el POS. `helpers.tsx:136` (FormModal) y `:242` (ConfirmModal) lo aplican a todos los formularios: abrir caja, movimientos, devoluciones, crear producto rápido, etc.
- **Reproducir:** importar `managementMessages.ts` con Node 22.18 o superior y pasarle mensajes reales. Resultado obtenido:

| Mensaje real                                                                                                        | Dónde aparece                  | Resultado  |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------- |
| `Código no encontrado: 7501234567890.`                                                                              | Lector del POS (`POS.tsx:600`) | **OCULTO** |
| `No hay suficiente stock de X (quedan 2).`                                                                          | Lector del POS (`POS.tsx:294`) | **OCULTO** |
| `El código 123 es de 2 productos…`                                                                                  | Lector del POS                 | **OCULTO** |
| `No se agregó nada: …`                                                                                              | Buscador del POS               | **OCULTO** |
| `Abre tu caja antes de cobrar.` / `Tu caja está abierta en «…». Trasládala…`                                        | Botón Cobrar                   | **OCULTO** |
| `Las salidas de efectivo de este turno superan RD$ 1,000.00: se requiere el PIN de un gerente.`                     | Movimiento de caja (FormModal) | **OCULTO** |
| `El fondo es menor que lo dejado en el último cierre (RD$ …). Agrega una nota…` / `…requiere el PIN de un gerente.` | Abrir caja (FormModal)         | **OCULTO** |
| `No hay suficiente efectivo en tu caja para este reembolso.`                                                        | Anulación (ConfirmModal)       | **OCULTO** |
| `Verifica o rechaza primero los abonos por transferencia pendientes…`                                               | Devolución (FormModal)         | **OCULTO** |
| `La venta tiene abonos. Usa una devolución.` / `La venta excede el plazo de devolución.`                            | Anular / Devolver              | **OCULTO** |
| `El código … ya es de «…». Usa otro código…`                                                                        | Crear producto rápido          | **OCULTO** |
| `Selecciona o crea el cliente…`, `PIN incorrecto.`, `Stock insuficiente.`                                           | —                              | pasa       |

- **Impacto en la caja:**
  - La cajera no distingue un código inexistente de una caída de red, y un aviso de stock no se distingue de un error.
  - Ante un límite de salidas o un fondo menor, el formulario pide «revisa tu conexión» en lugar de pedir el PIN o la nota, lo que lleva a reintentos inútiles o a pedir ayuda sin saber por qué.
  - En devoluciones y anulaciones se ocultan bloqueos de **dinero real** (abonos pendientes, efectivo insuficiente). El servidor sigue bloqueando la operación, así que no hay pérdida directa, pero sí un bloqueo operativo y una desinformación que invita a saltarse controles.
  - El cobro (`Checkout`, con su propio `setError(e.message)`) y el cierre (`Tienda.tsx`) **no** pasan por el filtro, así que los rechazos de la venta y del cierre siguen visibles.
- **E2E que van a fallar** (vista previa de producción) **[V por lectura]**: `tests/e2e/store.spec.ts` líneas 648, 664, 754, 825, 843, 958, 1015, 1166, 1436, 1641 y 1813 (11 aserciones). Ninguna se actualizó, aunque el protocolo pide avisar con «@claude actualiza e2e» cuando un texto cambia a propósito, y aquí el cambio no era intencional.
- **Códigos de estado:** no cambian. El cambio es solo de presentación. **[V]**

### P3-2 · Media · Las ramas 401 y 403 nunca se ejecutan **[V]**

- `managementQueryError` lee `error.status` (`managementMessages.ts:3-7`), pero `api()` lanza `new Error(result.message)` sin `status` (`apps/web/src/api.ts:305`). Un 403 («sin permiso») o una sesión vencida («Inicia sesión para continuar.») se muestran como «Revisa tu conexión y pulsa Reintentar». La prueba `management-messages.test.ts` pasa porque construye objetos `{status}` a mano.

### Diff mínimo propuesto (sustituye P3-1 y P3-2)

```diff
--- a/apps/web/src/helpers.tsx
+++ b/apps/web/src/helpers.tsx
 export const toast = (message: string, error = false) =>
-  toastHandler(error ? businessErrorMessage({ message }) : message, error);
+  toastHandler(message, error);
--- a/apps/web/src/api.ts
+++ b/apps/web/src/api.ts
-      throw new Error(result.message);
+      throw Object.assign(new Error(result.message), {
+        status: response.status,
+      });
--- a/apps/web/src/managementMessages.ts
+++ b/apps/web/src/managementMessages.ts
+const GENERIC =
+  "No pudimos completar la operación. Revisa los datos y tu conexión e inténtalo de nuevo. Si continúa, pide ayuda a gerencia.";
+// Lista NEGRA: la API ya responde en español de negocio; sólo se oculta lo técnico.
+const TECHNICAL =
+  /prisma|sql|select\s|insert\s|update\s|delete\s|exception|stack|constraint|token|secret|password|\/api\/|[{}<>\r\n]|\bP\d{4}\b|failed to fetch|networkerror|internal server error/i;
 export function managementQueryError(error: unknown): string {
   const status = (error as { status?: number } | null)?.status;
   if (status === 401) return "Tu sesión terminó. Vuelve a entrar para continuar.";
   if (status === 403) return "No tienes acceso a esta información. Pide ayuda a gerencia.";
+  if (status && status < 500) return businessErrorMessage(error);
   return "No pudimos cargar la información. Revisa tu conexión y pulsa Reintentar.";
 }
 export function businessErrorMessage(error: unknown): string {
   const message = (error as { message?: unknown } | null)?.message;
-  if (typeof message === "string" && message.length <= 240 && /^(Indica|…)\b/.test(message) && !/…/i.test(message))
-    return message;
-  return "No pudimos completar …";
+  return typeof message === "string" &&
+    message.trim() &&
+    message.length <= 300 &&
+    !TECHNICAL.test(message)
+    ? message
+    : GENERIC;
 }
```

- En `tests/management-messages.test.ts`, los casos ocultos que hay hoy («Failed to fetch», «Prisma P2025», «Indica SELECT…», un texto con `\n at`, un texto con `{…}`) siguen ocultos con este diff. Conviene añadir casos positivos para «Código no encontrado…», «Las salidas de efectivo…» y «Verifica o rechaza primero…».

---

## P4 · `e6fc291` + `62811f6` — ticket y cuadre de 80 mm

**Veredicto: Aceptar con cambios.**

- **[V] El ticket sin NCF dice «DOCUMENTO NO FISCAL – NO ES COMPROBANTE FISCAL»** y no imprime una fila «NCF:» vacía (`Prints.tsx`, rama `sale.ncf ? … : …`). La prueba renderiza el componente real con `renderToStaticMarkup`.
- **[V] Los datos del negocio salen de Ajustes.** Nombre, sucursal, dirección, `RNC:` (solo si hay `legalId`) y teléfonos salen de `BusinessHeader` (`Prints.tsx:67-90`). La prueba G2/P4 cubre `legalId` configurado y la P4 cubre `legalId` vacío.
- **[V] El cuadre conserva el formato anterior.** `CuadrePrint` **no** se modificó en el lote. La prueba fija «Detalles de monedas», «100 × 2», «Descripción / Totales» y «FIN DEL CUADRE».
- **[V]** La captura con Playwright dentro de `compliance.test.ts` solo corre con `NEXORA_CAPTURE_THERMAL=1`. Sin esa variable la suite pasa: 9/9.

### P4-1 · Baja · El logo predeterminado no está precacheado: puede faltar al imprimir sin red o en la primera impresión **[V]/[S]**

- `Prints.tsx:80` usa `src={b.logo || "/logo-grupo-macgen.png"}`. El service worker precachea solo `**/*.{js,css,html,svg,woff2}` (`apps/web/vite.config.ts:49`), y en el `sw.js` compilado el PNG no aparece **[V]**.
- `printSoon` imprime a los 50 ms (`Prints.tsx:33-34`). Si la imagen no está en la caché HTTP, el ticket sale sin logo **[S]**: con `alt=""`, Chrome no muestra el icono de imagen rota.
- **Diff mínimo:**

```diff
--- a/apps/web/vite.config.ts
-      includeAssets: ["icon.svg", "products/*.svg"],
+      includeAssets: ["icon.svg", "products/*.svg", "logo-grupo-macgen.png"],
```

### P4-2 · Baja · No se puede imprimir sin logo y las identidades se mezclan **[V]**

- Al borrar el logo en Ajustes se vuelve al de Grupo Macgen. Si no hay nombre configurado, el ticket muestra el logo de Macgen junto al título «Nexora POS». Es coherente con `PLAN_DE_TRABAJO.md`, porque la instalación es de un solo cliente, pero invierte la intención de G2 («solo img cuando hay logo»).
- **Propuesta:** aceptar la decisión para esta instalación. Si se reutiliza para otro negocio, el valor predeterminado debería venir de Ajustes o de `runtime-config.js`.

### P4-3 · Baja · `compliance.test.ts` importa `@playwright/test` en la suite unitaria **[V]**

- La importación de `chromium` es de nivel superior (`tests/compliance.test.ts:2`), así que carga Playwright en cada `vitest run` aunque la captura no se ejecute. Funciona, pero es acoplamiento innecesario.
- **Diff mínimo:** `const { chromium } = await import("@playwright/test");` dentro del `it`, después del `return` condicionado.

---

## P5 · `9c758a7` + `7a1399d` + `662b474` — privacidad

**Veredicto: Aceptar con cambios.**

Texto (`POLITICA_PRIVACIDAD.md:42-45`, `TEXTO_PIE_TICKET.md`, `Prints.tsx:377-380`):

- **[V] No afirma retención cero, ubicación de datos ni cifrado.** Dice lo contrario de forma explícita: «Esto no equivale a garantizar retención cero». La instrucción original pedía «y no se guarda allí», y ChatGPT, con buen criterio, no lo afirmó.
- **[V] «La aplicación no crea un archivo de la factura en la cuenta de Anthropic» es verificable y cierto.** `apps/api/src/invoice.ts:369-391` envía el documento en línea (`base64`) a `client.beta.messages.create`, sin usar la Files API.

### P5-1 · Media · El enmascarado de la lista de clientes se salta desde la propia interfaz **[V]**

El enmascarado no sustituye a la autorización (eso lo cubre la API, a cargo de Claude), pero ni siquiera cumple su objetivo visual:

1. **«Editar»** (`Management.tsx:1969`, `:1996-2001`): la cajera tiene `customers:write`, y el `FormModal` se abre con `initial={editing}`, que muestra el teléfono y la cédula/RNC completos.
2. **Selector de cliente del POS** (`POS.tsx:1166`): `<small>{c.phone}</small>` muestra el teléfono completo a cualquier cajera.
3. **Búsqueda** (`Management.tsx:1919-1928`): filtra por `c.phone` completo, así que funciona como oráculo (escribir dígitos y ver qué fila queda).
4. El correo (`<small>{c.email}</small>`) se muestra sin enmascarar.

- **Reproducir:** iniciar sesión como `seller` → Clientes → la columna muestra «•••123» → pulsar «Editar» → el campo Teléfono muestra el número completo.
- **Diff mínimo:**

```diff
--- a/apps/web/src/POS.tsx
-                    <small>{c.phone}</small>
+                    <small>
+                      {customerPrivateDisplay(c.phone, can(user.permissions, "sale:manage"))}
+                    </small>
--- a/apps/web/src/Management.tsx (Customers)
+  const manager = can(user.permissions, "sale:manage");
+  // Sin gerencia, editar no muestra ni reenvía cédula/teléfono existentes.
+  const editFields = manager
+    ? fields
+    : fields.filter((f) => !["phone", "legalId"].includes(f.key));
@@
-          fields={fields}
+          fields={editFields}
           initial={editing}
@@
-              (c.name + " " + c.phone)
+              (c.name + " " + (manager ? c.phone : ""))
```

(Habría que comprobar que el PATCH con campos omitidos no borra los existentes. La API usa PATCH, así que se espera que no; **[S]**.)

### P5-2 · Baja · Nota interna de redacción dentro del texto público **[V]**

- `POLITICA_PRIVACIDAD.md:45`: «antes de publicar este texto, la gerencia debe confirmar…» quedaría publicado tal cual. Debe usar el mismo formato de marcador que el resto del documento (`[ABOGADO: …]`).

```diff
-La aplicación no crea un archivo de la factura en la cuenta de Anthropic. Esto no equivale a garantizar retención cero por parte del proveedor: antes de publicar este texto, la gerencia debe confirmar las condiciones de conservación y el acuerdo de tratamiento aplicables a su cuenta. No se afirma que el proveedor elimine inmediatamente el documento sin evidencia contractual.
+La aplicación no crea un archivo de la factura en la cuenta del proveedor. Las condiciones de conservación del proveedor son las de su acuerdo de tratamiento de datos. [GERENCIA/ABOGADO: confirmar plazo de conservación antes de publicar.]
```

### P5-3 · Baja · El aviso sobre facturas de proveedor aparece en el ticket del cliente **[V]**

- `Prints.tsx:377-380` imprime en **todos** los tickets de venta un aviso sobre facturas de _proveedor_, que no tienen relación con la compra del cliente. Puede hacerle pensar que su compra se envía a una IA. `TEXTO_PIE_TICKET.md` lo aclara («no significa que la compra del cliente se envíe a IA»), pero el ticket impreso no.
- **Propuesta:** quitarlo del ticket y dejarlo en la política, o cambiarlo por «Aviso de privacidad: [URL/QR]». Es una decisión de la dueña o del abogado.

---

## P6 · `56ac7e4` — accesibilidad de venta y caja

**Veredicto: Aceptar.**

- **[V] No toca el teclado del POS.** El diff no modifica JS de eventos. El manejador global (`POS.tsx:406-504`, `keydown` en _capture_), el `onKeyDown` del buscador (Enter del lector) y `posKeyboard.ts` (F4/F8/F12 bloqueados con un diálogo abierto) quedan igual. `aria-pressed` en los métodos de pago no mueve el foco. Envolver `Cash` en `<div className="cash-page">` no rompe el diseño: `.main-content` no es grid ni flex con gap y ningún selector depende de hijos directos.
- **[V] El contraste cumple.** `--muted`, `--text`, `--primary` y `--focus` ≥ 4.5:1 en claro y oscuro (la prueba P6 pasa). Quitar `style={{color: p.category.color}}` elimina el texto de color libre, que no pasaba AA.
- **[V]** No quedan botones de solo icono sin `aria-label` en `POS.tsx`, `Tienda.tsx` ni `Management.tsx` (barrido con regex).

### P6-1 · Baja · `.modal button { min-width:44px; min-height:44px }` es global **[S]**

- `styles.css:3726-3735` afecta a todos los botones de todos los modales (interruptores, la «X» de los pagos, enlaces de texto). Es correcto para AA, pero puede dejar algunos modales más altos o desordenar filas compactas a 320 px. Conviene revisar las capturas del cobro y del cierre a 320 px antes de mezclar. No se observó ninguna rotura en el código.

### P6-2 · Baja (ya existía) · `.product-category` mide 8 px **[V]**

- `styles.css:1806-1810`: texto de 8 px en las tarjetas de producto. El contraste ya cumple, pero el tamaño queda fuera de lo razonable para leer. No lo introduce este lote.

---

## Regresiones transversales (e2e, selectores, i18n)

| Texto o selector                                                                                                                          | Cambiado por                   | E2E afectada                                                               | Estado                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Botón «Guía de estilos»                                                                                                                   | U2                             | `fuentes.spec.ts:435-443`                                                  | **[V]** falla en vista previa → U2-1                              |
| «Código no encontrado», «No hay suficiente stock», «es de 2 productos», «No se agregó nada», «ya es de «…»», «Verifica o rechaza primero» | P3 (toast/FormModal)           | `store.spec.ts:648, 664, 754, 825, 843, 958, 1015, 1166, 1436, 1641, 1813` | **[V]** van a fallar → P3-1                                       |
| «Vencimiento del crédito»                                                                                                                 | U-crédito                      | ninguna                                                                    | **[V]** sin impacto                                               |
| Textos del cambio de contraseña                                                                                                           | P1                             | `cuatro-cajas.spec.ts` usa la API, no la interfaz                          | **[V]** sin impacto                                               |
| «Demasiados intentos» en el acceso                                                                                                        | P1 (solo con `changeRequired`) | `repetible.spec.ts:118`                                                    | **[V]** sin impacto: el acceso normal sigue mostrando `e.message` |
| i18n                                                                                                                                      | —                              | La aplicación no tiene capa i18n; los textos están en el código            | n/a                                                               |

## Limpieza

- Worktrees temporales: `wt-auditp` (rama `claude/audit-batch`, solo con este documento) y `wt-auditp-f2` (detached en `origin/nexora-chatgpt-fase2`, que se eliminó al terminar junto con su `node_modules` y `dist`).
- No se crearon bases de datos ni quedaron procesos en ejecución.
