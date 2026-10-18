---
name: mercancia
description: >
  Procedimiento fijo de la dueña para cualquier cambio de mercancía en Nexora POS
  (suplementos, maquillaje, fajas): entradas, salidas, ventas o facturas hechas por
  Claude, regalos, traspasos Casa↔Tienda, ajustes y conteos. Úsalo siempre que la dueña
  pida sumar, sacar, mover, contar, facturar o pregunte «¿te mandé a…?».
---

# Mercancía con verificación triple

Orden de la dueña (18-oct-2026): todo cambio se verifica 3 veces antes y después; los conteos contra el sistema, 4 veces. Aunque cueste más tokens. Nada se aplica sin su confirmación.

Programa: `docs/coordinacion/claude-nube/mercancia.py` (entra solo con `entrar.py`).
Bitácora: `docs/operacion/bitacora-mercancia.jsonl` (una línea por cambio, con la frase exacta de la dueña).

## Pasos

1. **Busca antes de actuar.** `python3 mercancia.py buscar <producto>` para ver órdenes previas sobre ese producto. Si la pregunta es «¿te mandé a…?», contesta desde la bitácora y el historial del producto.
2. **Identifica el SKU exacto.** Si el nombre de la dueña puede ser dos productos (p. ej. Carnivor Mass 5.83 lb vs Shred 3.8 lb), pregunta.
3. **Plan sin aplicar:** `python3 mercancia.py ajuste|traspaso ... --orden "<frase exacta>"`. Muéstrale el antes → después.
4. **Con su sí:** repite con `--aplicar`. El programa lee la existencia por 3-4 caminos antes, la vuelve a leer justo antes de aplicar, aplica y la lee otra vez por 3-4 caminos. Si algo no cuadra, se detiene: no lo fuerces, investiga.
5. **Ventas o facturas que haga Claude** (por la API de ventas): después, `python3 mercancia.py nota --orden "..." --detalle "FS-xxxx, productos y montos"` y verifica la existencia de cada producto con `ajuste ... ` en modo plan (sin `--aplicar`).
6. **Conteos:** compara con 4 métodos (existencia, suma de movimientos, saldo anterior menos ventas, recálculo por renglón) y entrega la tabla antes de ajustar.
7. **Guarda:** `git add docs/operacion/bitacora-mercancia.jsonl && git commit && git push` en la rama de producción.

## Tipos

`conteo` (corrige un error de conteo), `entrada` (+), `salida` (−, pérdida/merma), `regalo` (− y a quién), `ajuste`. El tipo decide si el reporte de ganancias lo cuenta como corrección o como pérdida: no uses «conteo» para una salida real.

## Reglas que no cambian

- Casa solo se mueve con instrucción expresa; cada salida dice su destino (regalo a X / traspaso a Tienda).
- No tocar lo que la dueña contó o modificó ayer u hoy sin un conteo nuevo suyo.
- Nunca imprimas credenciales.
