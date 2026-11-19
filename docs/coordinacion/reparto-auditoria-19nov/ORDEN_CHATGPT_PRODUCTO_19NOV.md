# Orden para ChatGPT (NUBE y PC): dejar listo el producto que se vende (19-nov-2026)

Orden de Marcos: «procede a actualizar todo para el que vamos a vender» y empezar por la **venta online** (la web en la nube); la versión de PC va después.

## Situación
- La tienda de la dueña corre en `nexora-cloud` (nexora-pos-web). El producto que se vende corre en `producto-nexora` (nexora-saas-web), **1,031 cambios atrasado** y sin desplegar desde el 29-oct.
- Claude (Norexos 1) está igualando `producto-nexora` con la tienda en la rama `claude/producto-igualado-19nov` (multiempresa y RLS se conservan). **No hagan ese merge**; trabajen encima de esa rama cuando Claude avise que está lista, o mientras tanto en sus ramas desde `nexora-cloud` (lo que entre a la tienda llegará al producto).

## Reparto
| Quién | Qué |
|---|---|
| **ChatGPT NUBE** | Los 231 hallazgos de presentación de `CHATGPT.csv` (textos, ortografía, traducción, formato de montos y fechas, contraste, móvil) en rama `chatgpt-nube/auditoria-ui-19nov`. Incluye lo que está en pantallas protegidas por el diseño de Dot (POS.tsx, Management.tsx, Dashboard.tsx…), que Claude no puede tocar: «Infinity en stock» → «Servicio», etiqueta «Fondo de apertura menor» (`opening_shortfall`), botón «Mover cobro a otra caja» para efectivo «Recibido por la dueña», enviar `operationId` en el formulario de ajustes. |
| **ChatGPT PC** | Venta online del producto: **página de precios pública** (Medio US$69/mes, Completo US$119/mes, piloto 60 días; textos en `docs/venta/HOJA_DE_PRECIOS.md` y `LANDING_EN_PLANES.md`), landing ES/EN, panel para invitar negocios piloto (`docs/piloto/ESPEC_PANEL_INVITACIONES_16NOV.md`), marca neutra del producto (nada de «Grupo Macgen» ni fotos de la tienda), capturas reales para la venta. Rama `chatgpt-pc/producto-venta-19nov` desde `claude/producto-igualado-19nov` cuando Claude avise. |

## Reglas fijas
1. Claude audita, pasa `money-guard` y los 3 CI, y **despliega**. ChatGPT no despliega ni mezcla a `nexora-cloud` ni a `producto-nexora`.
2. Nada de API, base de datos, permisos ni dinero en ramas de diseño; si un texto sale del servidor, lo corrige Claude.
3. No tocar datos del negocio (precios, costos, existencias, clientes, usuarios).
4. Multiempresa: ninguna pantalla nueva puede mostrar datos de otra empresa; no quitar filtros por empresa.
5. Un commit por punto con su id; 3 CI verdes en el último commit; capturas antes/después (1440×900 y 390×844, claro/oscuro, ES/EN) en `docs/auditoria-ui/capturas/`.
6. Conteo al entregar: recibí N; corregidos A, no se puede B, ya estaban C, necesitan decisión D; A+B+C+D = N.
7. Decisiones de la dueña (no las tomen ustedes): cobro bancario, términos/abogado, dominio, abrir registro público, ONAPI, definición de ganancia, aprobación de equipos de admin, tasa del dólar de GV.
