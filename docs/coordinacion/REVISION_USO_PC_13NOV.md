# Revisión de diseño y facilidad de uso (ChatGPT PC, 13-nov)

Orden de la dueña. Es una revisión de cómo se ve y se usa Nexora, para la tienda y para la versión que se va a vender. Solo lectura y documentos: no cambies código y no despliegues. Rama `chatgpt-pc/consulta-mejoras-13nov`, creada desde `origin/nexora-cloud`.

## Paso 1: tu lista, antes del catálogo
Mira la aplicación (en local, con datos de prueba, a 1366 px y a 390 px) como la cajera, la vendedora, la gerente y la dueña. Anota hasta unas 12 mejoras de diseño, comodidad o modernidad. Cada una con título, una o dos líneas, la pantalla o `archivo:línea`, y si aplica a la tienda, al producto o a ambas. Numérala `P-A01`, `P-A02`… Guárdala en `docs/coordinacion/consulta-13nov/PASO1_A_CIEGAS_PC.md`, súbela en su propio commit y haz push **antes** de traer el catálogo. Máximo 90 minutos.

## Paso 2: el catálogo
```
git fetch origin consulta/catalogo-13nov
git show origin/consulta/catalogo-13nov:docs/coordinacion/CONSULTA_MEJORAS_CATALOGO_PC_13NOV.md
```
Son 28 propuestas de diseño, comodidad y modernidad. La evidencia está en el commit `3705f7d8`: `git show 3705f7d8:<archivo>` (en PowerShell, `Select-Object -Skip <línea-1> -First <n>`). Tu veredicto es sobre el código de tu `origin/nexora-cloud`; anota su SHA en la primera línea de la respuesta (`Base: <SHA>`). Las citas `producto-nexora:` se leen con `git show origin/producto-nexora:<ruta>`.

Una ficha por propuesta:
```
### COM-03 · <título>
- **Evidencia:** confirmada | corregida | falsa | no abierta (qué abriste)
- **Veredicto:** apoyo | apoyo con cambios | no la haría | falta un dato
- **Impacto:** 1–5 · **Esfuerzo:** P | M | G · **Riesgo:** bajo | medio | alto · **Visto en pantalla:** sí | no
- **Respuesta a la pregunta del catálogo:** …
- **Qué harías en su lugar o qué cambiarías:** … (o «nada»)
- **Certeza:** comprobado | deducido | no comprobado
```
Impacto 5 = ahorra tiempo en cada venta o evita perder dinero; 4 = se nota todos los días; 3 = cada semana; 2 = casos raros; 1 = cosmético. Esfuerzo P = hasta 1 día, M = de 2 a 5 días, G = más de una semana. Si no apoyas una propuesta, di qué harías en su lugar. No des veredicto sin abrir la evidencia: pon `no abierta` y `falta un dato`. Elige hasta 10 que valgan una orden de construcción y descríbelas con palabras, sin código.

## Paso 3: tus propuestas
Hasta 12 propuestas tuyas, con evidencia y el formato del catálogo, y la tabla `ID | Dimensión | Versión | Impacto | Esfuerzo | Riesgo | Parecida a`. Añade al final de tu Paso 1, en un commit nuevo, la tabla `Mía | En el catálogo | igual / parecida / distinta / —`. Escribe también hasta 5 cosas que quitarías o simplificarías.

## Paso 4: síntesis
Tus 5 primeras para la tienda y tus 5 primeras para el producto, las victorias rápidas, qué no harías todavía y tus desacuerdos con el catálogo (hasta 5).

## Pantalla: lo que ya está en `nexora-cloud`
Comprueba y anota con captura en `RESULTADOS_CHATGPT.md`:
- **C6:** en una solicitud de anulación, el pago dice «Efectivo», no `cash`.
- **C15:** con existencia 1, al aumentar a 2 el aviso dice el producto y cuántas quedan.
- **C13:** una usuaria sin permiso de gestionar ventas ve «hasta N % sin PIN» junto al descuento de cada línea; una gerente no.
- **C1:** con artículos y sin cliente, «Cobrar» (o F12) abre el selector; al elegir el cliente, la ventana de cobro se abre sola. F4 sigue igual.

## Entrega
Archivos en `docs/coordinacion/consulta-13nov/`: `PASO1_A_CIEGAS_PC.md`, `RESPUESTA_CHATGPT_PC.md` (secciones: Resumen para la dueña en 10 líneas · Tabla de veredictos · Fichas · A fondo · Propuestas propias · Síntesis · Lo que no pude comprobar) y `capturas/`. Un push por paso; solo se espera el CI del último. Avisa arriba en `docs/coordinacion/RESULTADOS_CHATGPT.md`. Cierra navegadores y procesos al terminar cada tanda. Si algo no arranca, `pnpm install --frozen-lockfile`; si sigue sin arrancar tras dos intentos, evalúa por código y pon `Visto en pantalla: no`.
