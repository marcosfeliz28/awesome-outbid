# Órdenes del 24-oct, tarde (Claude nube, arquitecto)

**Decisión de la dueña (24-oct):** el lote del verifón se pide en **todo cierre de caja con evidencia de pago con tarjeta**, sea caja solo de tarjeta o mixta. Sin tarjeta, no se pide.

Reglas de siempre: no tocar Render, la base de la tienda, credenciales ni dominio; no desplegar; e-CF y B04 en pausa; nada que deje ventas fuera de la DGII; la IA solo propone. Cada punto lleva su propio commit y una prueba que falle antes del arreglo y pase después. `pnpm check` y los 3 CI en verde, y se avisa con el SHA en `RESULTADOS_CHATGPT.md` (ChatGPT) o en `REVISION_NOCHE_CLAUDE.md` (Claude PC).

## Claude PC (ramas `claude-pc/*`, con varios agentes en paralelo)
1. **CPC-2, terminar** en `claude-pc/lote-verifon`:
   - aplicar la regla de la dueña de arriba;
   - arreglar el ayudante de las e2e que cierra la caja sin lote (`tests/e2e/store.spec.ts`; el ayudante con `expect(response.ok())`, línea 58): debe mandar el lote cuando hubo tarjeta, sin aflojar la regla;
   - guardar solo el número de lote (sin la foto como data URL);
   - comparar los 4 fallos de integración contra `7ebb670`.
2. **CPC-6, auditar ChatGPT nube N-01 a N-15** (`origin/nexora-chatgpt-nube-ia`, 84 commits). Prioridad en seguridad:
   - que el asistente y el MCP OAuth (N-15) no salgan de su empresa (RLS y `tenantUnique`);
   - que no lleguen claves al navegador ni a las herramientas (N-06);
   - que el acceso de soporte (N-05) sea de solo lectura y caduque;
   - que la cuota (N-02) no se pueda saltar;
   - que la foto de transferencia (N-08) no apruebe nada sola;
   - que la anulación (N-04) pida el «sí» y respete permisos.

   Hallazgos con archivo:línea en `REVISION_NOCHE_CLAUDE.md`, con veredicto por bloque.
3. **CPC-4** en `claude-pc/pc13-correcciones`, desde `origin/producto-nexora`:
   - `reports.ts:314` debe filtrar las alertas NCF y `sale_void_request` para quien no tiene `*`;
   - no resolver alertas `ncf_sequence` si la zona horaria es inválida.
4. **CPC-5** en `claude-pc/marca-producto`, desde `origin/producto-nexora`. La prueba de marca debe recorrer `apps/web/src/**`, `apps/api/src/**`, `apps/web/public/**` y `README.md`. Hay que quitar lo que se escapa: README, logo de MacGen y datos de ejemplo.
5. **CPC-7, borradores** en `claude-pc/borradores-pc12` (solo docs): la correspondencia de campos del 606 y del IT-1 con las tablas del sistema, marcada «borrador para la contadora».

## ChatGPT PC (`producto-nexora`)
Los arreglos de PC-13 y la prueba de marca los hace Claude PC (CPC-4 y CPC-5): **no los toques**. Sigue en este orden:
1. **PC-06**, exportación completa por empresa (Excel y JSON).
2. **PC-07**, respaldo y restauración por empresa, con prueba de restaurar en una base vacía.
3. **PC-15**, interruptores por empresa. Incluye que la tasa del dólar llegue a todas las empresas, no solo a `"main"` (`usd-rate.ts:96-108`).
4. **PC-09**, puerta de la fase 1.
5. **PC-16**, app de escritorio Tauri que imprime en la térmica de 80 mm y abre la gaveta.
6. **PC-18**, versión local con NSIS.
7. **PC-19**, licencia Ed25519.
8. **PC-20**, respaldo diario fuera de la PC, con alerta roja a las 48 horas sin respaldo.
9. **PC-17**, instalador firmado y actualización automática. Deja escrito qué certificado hace falta; lo compra la dueña.
10. **PC-21**, IA de la versión local por un intermediario en la nube.
11. **PC-22**, pruebas en Windows 10 y 11 limpios y documento «Listo para vender».

Cuando haya CI verde, mezcla `nexora-cloud` en `producto-nexora` (trae CPC-1).

## ChatGPT nube (`nexora-chatgpt-nube-ia`)
N-01 a N-15 entregados. Claude PC los audita (CPC-6), y lo que salga como «corregir» va primero.
1. **N-16 a N-35**: tus 20 mejoras de `cc162ec`, en orden. Empieza por las 6 pequeñas que sirven también a la tienda (1, 2, 3, 4, 10 y 11).
2. Mantén la rama al día con `producto-nexora` mediante merge, sin rebase.
3. Una propuesta en docs, sin código, de los planes y precios del producto: qué incluye cada plan, cuota de IA por plan y costo por empresa en Render. Lo decide la dueña.
