# Veredicto y orden: tablero móvil del administrador, fase A (Claude nube, 24-oct-2026)

Fuentes: `PROPUESTA_ADMIN_GEMINI.md`, `ORDEN_REDISENO_ADMIN.md` y los 3 estilos de Claude nube (A, B y C). Las propuestas de ChatGPT PC y ChatGPT nube **todavía no han llegado**: cuando lleguen se cruzan y esta tabla puede cambiar. La dueña aún no escoge estilo, así que la fase A se construye con **temas intercambiables** (A, B y C) y ella elige al verlo funcionando.

## Veredicto

| # | Idea de Gemini | Veredicto | Fase | Condición del arquitecto |
|---|---|---|---|---|
| 9 | Modo privacidad | **Aprobado** | A | Solo visual: desenfoca en pantalla, no protege. Los costos siguen ocultos por permiso en el servidor. Recordar la elección en el equipo. |
| 3 | Cajas en vivo | **Aprobado** | A | Con `GET cash-sessions`, el cuadre y SSE `events`. El efectivo esperado solo para quien ya lo puede ver (`canViewCashExpected`). **Nada parpadea** (accesibilidad): una etiqueta «Conviene una entrega» por encima del tope, que se configura. |
| 2 | Baraja de un pulgar | **Aprobado con cambios** | A | Deslizar solo **abre** la tarjeta. Aprobar o rechazar se hace con **botones**, y con el PIN o la confirmación que ya pide cada ruta (`void-requests/:id/approve` y `reject`, `payments/pending-transfers`, el cuadre con diferencia). Rechazar exige motivo. Nunca se aprueba dinero con un gesto suelto. Botones reales además del gesto, para teclado y lector de pantalla. |
| 4 | Mapa de liquidez | **Aprobado** | A | Un **GET nuevo de solo lectura** que suma lo que ya existe: gavetas, recibido por la dueña (`ownerReceived`), transferencias verificadas y por verificar, `cod/pending` y crédito. **Sin cambios a la base.** Solo para el permiso `*`. Una prueba que compare cada bolsillo con su reporte actual. |
| 5 | Escáner antifraude | **Aprobado, solo lectura** | A | Sobre `GET audit-log` (`*`), filtrado del día. Muestra hechos («3 cambios de método de pago»), no acusa a nadie. Cada fila abre la venta. |
| 1 | Orbe de pulso y margen | Aprobado | B | El margen con la fórmula fija y `Decimal` del servidor; nunca calculado en el navegador. Requiere la meta del mes, que es un ajuste nuevo. |
| 7 | Podio de vendedoras | Aprobado | B | Sobre `incentives`. Solo para el administrador. Sin comparar en público a las cajeras. |
| 6 | Isla «Pregúntale a Nexora» con voz | Aprobado | B | Con N-01 y su cuota. Dictado solo si el navegador lo trae; sin grabar audio en el servidor. |
| 8 | Historias de inventario con borrador de IA | Aprobado | B | La IA propone y una persona aprueba (N-11, N-12). |
| 10 | Cápsula nocturna | Aprobado | B | Con N-07 y Telegram. Apagado por defecto. |

**La caja de las cajeras no cambia en ninguna fase.**

## Cambio de responsable (25-oct, 01:45 UTC)
La fase A la construye **ChatGPT nube** (la PC no respondía), en la rama **`chatgpt-nube/tablero-admin-a`**, desde `origin/nexora-cloud`. ChatGPT nube **no** hace los arreglos de CPC-10 (gaveta y dólar): siguen siendo de ChatGPT PC en `nexora-chatgpt-pc-producto-fixes`. Todo lo demás de esta orden vale igual para ChatGPT nube.

## Orden para ChatGPT PC: construir la fase A

**Rama:** `chatgpt-pc/tablero-admin-a`, creada desde `origin/nexora-cloud`. El tablero sirve a la tienda y al producto; Claude nube mezcla hacia los dos.

**Antes de empezar:** cerrar los arreglos pendientes de `ORDEN_REDISENO_ADMIN.md` (gaveta al cobrar, dólar y licencia).

Con la mayor cantidad de agentes en paralelo: uno por tarjeta, otro para las pruebas y otro que revise el diff y el CI.

1. **Estructura.** `apps/web/src/admin-dashboard/`, con un componente por tarjeta:
   - `PrivacyToggle`, `RegistersLive`, `ApprovalDeck`, `LiquidityMap` y `AnomalyScanner`;
   - `Dashboard.tsx` las monta arriba solo si el usuario tiene `reports:read` o `*`, según la tarjeta;
   - el resto del tablero actual queda debajo, sin borrarse.
2. **Temas.** Variables CSS para los 3 estilos (A «Cristal nocturno», B «Ejecutivo claro», C «Centro de mando») con un selector en Configuración, guardado por equipo. Contraste ≥ 4.5:1 en los 3. Respeta `prefers-reduced-motion`.
3. **Celular primero.** A 320 y 390 px nada se sale y no hay desplazamiento horizontal. Botones de 44 px o más. En la computadora: rejilla de 2 o 3 columnas, cómoda con el mouse y con foco visible.
4. **Datos.**
   - Usar las rutas que ya existen.
   - La única ruta nueva es `GET /api/dashboard/liquidity`: solo lectura, permiso `*`, sumas en `Decimal`, sin migración y con prueba de integración.
   - En vivo por el SSE `events` que ya existe, sin consultar cada pocos segundos.
5. **Dinero.** Nada se aprueba sin pasar por la ruta y las protecciones actuales: PIN, permisos y bitácora. La baraja solo junta lo pendiente.
6. **Pruebas (cada una falla antes y pasa después):**
   - unitarias de cada tarjeta;
   - integración de `liquidity`: cada bolsillo coincide con su reporte, y un usuario sin `*` recibe 403;
   - e2e a 320 y 390 px con los 3 temas: privacidad, aprobar una anulación con PIN, rechazar con motivo, y la caja de las cajeras igual que antes.
7. **Prohibido:** tocar `.github/workflows`, Render, la base de la tienda, migraciones, la pantalla de la caja (`POS.tsx`) y los precios.
8. **Entrega:** un commit por tarjeta, `pnpm check` y los 3 CI en verde (`verify`, `windows-installer`, `render-images`), aviso en `RESULTADOS_CHATGPT.md` con el SHA y capturas a 390 px de los 3 temas. Claude PC audita y Claude nube despliega con el sí de la dueña.
