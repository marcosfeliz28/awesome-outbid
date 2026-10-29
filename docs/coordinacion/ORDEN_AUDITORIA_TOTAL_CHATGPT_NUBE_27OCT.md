# Orden a ChatGPT nube: auditoría total (27-oct-2026)

Orden de la dueña: ChatGPT audita todo lo que hay; Claude nube (Nexora 1) gasta lo mínimo. Solo lectura de código y pruebas: **no despliegas, no tocas Render, base, credenciales ni `nexora-cloud`/`producto-nexora`**. Entrega por rama `chatgpt-nube/auditoria-total-27oct` y documento `docs/qa/AUDITORIA_TOTAL_27OCT.md`.

## Alcance (en este orden, severidad crítico/alto/medio/bajo, cada hallazgo con `archivo:línea`, cómo reproducirlo y arreglo propuesto)
1. **Dinero y caja** (lo más importante): margen = (precio−costo)/precio sin restar ITBIS y mínimo 15 %; descuentos aplicados por la caja (nunca cambiar precios); arqueo ciego (la cajera con caja abierta no ve importes: «Ventas», PDF, ticket, anulaciones, créditos); pagos, anulaciones, transferencias, créditos y contra entrega; fórmula de utilidad única (`netProfit` vs `grossProfit`, `cash.ts:488-507`).
2. **Ramas abiertas** (revisa el código, no solo la descripción): PR #11, #12, #13, #14, #15, #16 y `chatgpt-pc/lumina-motion-integracion`; ramas de Claude PC `pc23-anulacion-fix`, `a1-formula-utilidad`, `b01-ventas-caja-ciega`. Orden de mezcla sugerido y conflictos esperados.
3. **Seguridad:** permisos por rol, rutas prohibidas (que no monten ni disparen peticiones), entradas sin validar, exportaciones, `docs/seguridad/PLUGINS*.md`.
4. **Datos y migraciones:** idempotencia, bitácora inmutable, índices/disparadores, `operationId` repetidos, concurrencia.
5. **Producto (SaaS) y tienda:** separación por empresa (tenant), que nada de la tienda (GV, MacGen) se filtre al producto.
6. **Accesibilidad y móvil:** 390 px, contraste 4.5:1, foco, movimiento reducido.
7. **Instalador Windows** (`chatgpt-pc/cola3-26oct`): tildes/UTF-8, contraseña local 4–20, pruebas.
8. **CI y pruebas:** pruebas frágiles, mocks (p. ej. Google Drive en Configuración, `missing.join()`), límite PWA de 2 MiB.

## Entrega
Tabla de hallazgos ordenada, qué es seguro mezclar ya, qué requiere decisión de la dueña y propuesta de arreglos en ramas separadas con prueba que falle antes y pase después. Sin cifras inventadas.
