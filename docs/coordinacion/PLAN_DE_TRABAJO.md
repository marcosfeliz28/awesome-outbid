# Plan de trabajo Nexora · de aquí en adelante

Reparto: **ChatGPT implementa y ejecuta; Claude audita, fusiona y despliega; la dueña decide y hace lo que exige su cuenta.** Todo se anota en `TABLERO_NEXORA.md` (sección Entregas). Detalle de cada ID en `COLA_HALLAZGOS_NEXORA.md`.

## 0. Logo incluido
El logo de Grupo Macgen ya está en el repo: `apps/web/public/logo-grupo-macgen.png` (600 px, negro sobre blanco, 9 KB, hecho para la térmica de 80 mm).
- **ChatGPT:** que `Prints.tsx` use ese archivo como logo por defecto cuando `settings.logo` esté vacío, y que la pantalla de Ajustes siga permitiendo reemplazarlo. Prueba: ticket sin logo configurado muestra el archivo; con logo configurado muestra el configurado.

## 1. Lo que ChatGPT debe IMPLEMENTAR (por lotes; un commit por ID)
Instrucciones completas en `MENSAJE_PARA_CHATGPT_IMPLEMENTAR.txt` (carpeta proyecto-facturacion de la rama de trabajo de Claude, y pegado en el chat por la dueña).

| Lote | Contenido | Antes de |
|---|---|---|
| 1 | L1 limitador de login, P1a PIN por usuario objetivo, C1 contraentrega, C2 arqueo ciego, F1 foto de pago, F2 lista blanca de costos, E1 enumeración, M1 movimientos de caja, M2 reportes netos, D1 motivo de descuento | Dejar vender a las 4 cajas |
| 2 | I1 lotes, K1 reintentos, K2 índices únicos, N2 nginx fija la IP de la API, X1–X4 infraestructura y respaldos, menores de inventario | Producción real |
| 3 | G1/G2 ticket no fiscal y datos del negocio, G4 devoluciones, G5 PDFs, O1 venta offline con precio viejo, S1–S4 PWA, G6/G7 anonimizar clientes, G8 Sentry, G9 limpieza al cerrar sesión, G10 accesibilidad, G13–G15 textos y licencias, logo por defecto | Imprimir tickets a clientes |
| 4 | Instalador: W1–W4 y restauración segura | Instalar en la laptop de la tienda |

## 2. Lo que ChatGPT debe EJECUTAR y reportar con salida real
| # | Ejecución | Evidencia que Claude necesita |
|---|---|---|
| E1 | `pnpm check` e integración completa (API compilada, base nueva) tras cada lote | Conteo de pruebas y salida |
| E2 | Docker sandbox: `compose.audit.yaml` arrancado dos veces seguidas y `docker compose restart api` con la web arriba | Salida; si no hay Docker, dilo |
| E3 | nginx real con la plantilla: cabeceras, CSP con la PWA, cámara y modo sin conexión; `curl -I /api/health/live` (cabeceras no duplicadas) | Capturas o salida |
| E4 | Restauración real de un export sobre una base descartable (nunca producción) y comparación de conteos de tablas | Salida del `pg_restore` y conteos |
| E5 | `Windows-Smoke.ps1`, `Restore-FaultInjection.ps1`, `Transaction-FaultInjection.ps1` en un Windows 11 limpio o máquina virtual | Versión de Windows/Node y salida; ChatGPT reportó antes Windows 10 |
| E6 | Prueba de impresión real en la térmica de 80 mm: ticket, cuadre de caja y PDF | Foto del papel |
| E7 | Migraciones nuevas sobre una copia de la base con datos y las 21 migraciones previas | Salida de `migrate deploy` |

## 3. Lo que Claude necesita SABER de ChatGPT (responder por escrito, sin valores secretos)
1. ¿Con qué herramienta trabajas (Codex local, Codex en la nube, chat con ZIP)? ¿Puedes empujar ramas y abrir PR? Tus commits salen con el nombre de la dueña.
2. Nombres (no valores) de las variables de entorno configuradas hoy en `nexora-pos-api` y `nexora-pos-web` en Render, incluidos `ANTHROPIC_API_KEY`, `SENTRY_DSN`, `VITE_SENTRY_DSN`, `BACKUP_DATABASE_URL` y las de AWS: ¿cuáles están definidas?
3. ¿El respaldo diario Render → S3 → laptop está activado? ¿Con qué bucket y política de retención (sin credenciales)?
4. Plan de la base en Render (Hobby, Pro u otro) y la ventana de recuperación que muestra el panel.
5. Valores no secretos de Ajustes del negocio en producción: nombre, sucursal, dirección, teléfono, `legalId` (aunque sea vacío), `taxIncluded`, `returnDays`, `creditApprovalThreshold`, `cashDifferenceLimit`, `allowOfflineSales`, `allowCreditSales`, `receiptWidth`.
6. Nombres de usuario (no claves) de las 4 cajas y de los administradores, y si siguen con clave de 4 dígitos.
7. Cantidad de productos, unidades y clientes cargados hoy y cómo se importó el inventario.
8. Modelo de la impresora térmica y del lector de códigos que usará la tienda.
9. Qué pruebas de la sección 2 no puedes ejecutar y por qué.
10. Cualquier cambio que hayas hecho en Render o en el repo desde el commit 21370a3 (cada deploy y cada push).

## 4. Lo que hace CLAUDE
- Audita cada lote con agentes adversariales (intentan refutar cada hallazgo) y reproduce las regresiones.
- Fusiona en `nexora-cloud` y despliega en Render: primero la API, siempre después la web.
- Revisa logs, eventos, métricas y estado de las migraciones tras cada despliegue y reporta.
- Mantiene el tablero, la cola y los borradores legales.

## 5. Lo que hace la DUEÑA (nadie más puede)
1. En la pestaña Shell de `nexora-pos-api`: el comando de `PASOS_RENDER_PARA_LA_DUENA.txt` con los nombres de usuario de las 4 cajas.
2. Cambiar las credenciales del expediente de auditoría.
3. Dar: RNC real, nombre legal, teléfonos, correo de contacto y plazo/condiciones de devolución.
4. Llevar los textos de `docs/legal/` a un abogado antes de publicarlos.
5. Hacer las 40 pruebas de aceptación con la impresora, el lector y los celulares reales.
6. Definir la fecha de salida a producción.

## 6. Cómo nos sincronizamos
- ChatGPT empuja cada lote a la rama `nexora-chatgpt` (un commit por ID) y abre un PR hacia `nexora-cloud` titulado «Lote N».
- La dueña me dice el número del PR; me suscribo y recibo en esta sesión cada comentario, cada commit y el estado de las comprobaciones.
- Claude comenta el resultado de la auditoría en el PR, fusiona y despliega. Nadie empuja directo a `nexora-cloud` salvo documentación del tablero.
- Si ChatGPT sólo puede entregar ZIP, la dueña lo sube a la sesión y Claude lo compara contra `nexora-cloud` como hasta ahora.
