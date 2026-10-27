# Orden de auditoría: cambios nuevos de Claude nube (25-oct-2026)

Pedido de la dueña: **Claude PC y Gemini auditan, cada uno por separado y sin ver lo del otro, todo lo que Claude nube hizo o mezcló hoy.** Es solo lectura: no hay que desplegar, ni tocar Render, la base de la tienda, credenciales o el dominio, ni editar `.github/workflows`. **Regla fija:** usar la mayor cantidad de agentes posible en paralelo, uno por bloque.

## Qué auditar

### A. Tienda (`nexora-cloud`), YA EN VIVO: prioridad máxima
| # | Cambio | Commit | Archivos clave |
|---|---|---|---|
| A1 | El PIN de aprobación siempre es de otra persona (la dueña «*» sí puede usar el suyo) | `7ca3528e` (rama `claude/pin-otra-persona`) | `apps/api/src/security.ts` (`managerPinApproval`), `cash.ts` (vale, descuadre, salidas, traslado), `sales.ts` (descuento, crédito, «Recibido por la dueña»), `offline-sale-review.ts`, `apps/web/src/Tienda.tsx`, `tests/pin-otra-persona-api.test.ts` |
| A2 | Pago en efectivo en dólares | `54a42c9d` (rama `claude/pago-dolares`) | migración `202610250301_pago_dolares`, `sales.ts`, `cash.ts` (esperado en RD$ y US$), `offline-sale-review.ts`, `POS.tsx`, `Prints.tsx`, `tests/pago-dolares-*.test.ts` |
| A3 | El cierre imprime solo el cuadre y pregunta aparte si imprimir los productos | `6b7e1e0b` | `apps/web/src/Tienda.tsx` (`PrintModal`), `tests/e2e/store.spec.ts` |

### B. Producto (`producto-nexora` `25389555`, sin desplegar)
| # | Cambio | Commit o rama |
|---|---|---|
| B1 | NCF tradicional por venta (B01/B02), apagado por defecto | `ae504a22` (`apps/api/src/ncf-sequences.ts` `takeNcf`) |
| B2 | Empresa piloto por invitación del operador | `7ee186e6` (`apps/api/src/platform.ts`, `/api/auth/accept-invitation`) |
| B3 | PC-23: cobro manual | `06847e33` (`platform-billing.ts`, tabla inmutable `PlatformPayment`, solo lectura al suspender) |
| B4 | PC-24: paquetes de IA | `6af297aa` (`platform-ai-packs.ts`, `AiPackCredit`, `reserveAiQuestion`) |
| B5 | CPC-10: gaveta, tasa del dólar con tope del 25 %, licencia v2 y restos de CPC-8 | `c6bb896d` (`claude/cpc10-gaveta-dolar`) |
| B6 | Mezcla de todo lo anterior | `25389555` (`alerts.ts`, matriz de rutas) |

### C. Producto, ramas todavía sin mezclar
| # | Cambio | Rama |
|---|---|---|
| C1 | Panel de la plataforma para la dueña (`/plataforma`) | `claude/panel-plataforma` (`9925d92f`, `dd3f3407`) |
| C2 | Botón «Ayuda» y avisos al operador | `claude/soporte-ayuda` (en curso) |
| C3 | La IA de ChatGPT nube (N-01 a N-15) y el acceso de soporte en el producto | `claude/ia-al-producto` (en curso) |

## Qué buscar (por orden)
1. **Dinero:** doble conteo o pérdida en el cuadre (pesos y dólares), vuelto, anulaciones y devoluciones; redondeo con `Decimal`; caja ciega.
2. **Autoaprobación:** cualquier camino por el que alguien se apruebe a sí mismo (PIN, vale, descuento, cierre).
3. **Fiscal:** que ninguna venta quede fuera de la DGII; NCF sin repetir y sin huecos en ventas concurrentes; e-CF y B04 siguen en pausa.
4. **Separación entre empresas:** RLS y `tenantUnique` en todo lo nuevo; que el operador no vea datos del negocio de los clientes.
5. **Seguridad del operador:** token comparado en tiempo constante, límite de intentos, invitación de un solo uso, que el token nunca quede en logs ni en `localStorage`.
6. **Pruebas:** que cada prueba nueva falle sin el cambio y pase con él; huecos de cobertura.
7. **Pantallas:** a 320 y 390 px, botones de 44 px como mínimo y contraste de 4.5:1 o más; que la caja de las cajeras siga sencilla.

## Entrega
- **Claude PC:** `docs/coordinacion/AUDITORIA_25OCT_CLAUDE_PC.md`, en la rama `claude-pc/auditoria-25oct`.
- **Gemini:** `docs/coordinacion/AUDITORIA_25OCT_GEMINI.md`, en la rama `nexora-gemini-auditoria`.

Para cada hallazgo: archivo:línea, gravedad (crítica, alta, media o baja), cómo reproducirlo y el arreglo propuesto. Al final, un veredicto por bloque (A1 a C3): **aprobado**, **corregir** o **bloqueado**. Un hallazgo crítico en A (lo que ya está en vivo) se avisa de inmediato: arriba del documento, con la palabra **URGENTE**. Claude nube cruza las dos auditorías y corrige.
