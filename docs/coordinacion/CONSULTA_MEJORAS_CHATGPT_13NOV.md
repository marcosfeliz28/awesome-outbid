# Consulta de mejoras e implementos: segunda opinión de ChatGPT (PC y nube)

**Orden de la dueña (12-nov-2026, noche), redactada por Norexos 1.** Para ChatGPT nube y ChatGPT PC.

El catálogo que acompaña a este instructivo (82 propuestas) **no está en `nexora-cloud`**: vive en la rama `consulta/catalogo-13nov` para que no te lo encuentres al buscar en el repositorio. Se abre al empezar el Paso 2, no antes (sección 5).

## 0. Qué se te pide

Una opinión independiente, con evidencia, sobre cómo mejorar Norexos / Nexora POS en seis dimensiones (estructura, diseño, comodidad, seguridad, eficiencia y modernidad) y para sus dos versiones: la que usan las empleadas de la tienda y la que se va a vender. Son cuatro pasos:

1. **Tu lista propia, a ciegas**: lo que tú mejorarías, antes de ver lo que propuso Claude.
2. **Tu evaluación del catálogo**: una ficha por cada propuesta que te toca.
3. **Tus propuestas completas**, con la misma ficha y evidencia.
4. **Tu síntesis**: qué harías primero, qué no harías y en qué no estás de acuerdo con el catálogo.

El entregable es un documento de respuesta por agente. **No se construye, no se mezcla y no se despliega nada.**

## 1. Para qué sirve y qué se espera de ti

La dueña decide qué se construye. El catálogo lo preparó Claude: varios revisores leyeron el código por área y un segundo revisor intentó refutar cada propuesta antes de dejarla entrar. Aun así, todo salió de una sola familia de modelo y comparte sus puntos ciegos. Tú eres la segunda opinión.

Lo que más vale de tu respuesta, en este orden:

1. **Dónde el catálogo se equivoca**: una evidencia que no es cierta, un problema exagerado, una solución peor que otra más simple, un riesgo que no se vio.
2. **Lo que el catálogo no vio.**
3. **Un orden de prioridad defendible**, pensado para quien usa el sistema y no para quien lo programa.

Estar de acuerdo con todo sería un resultado sospechoso. Buscar desacuerdo por cumplir también: cada veredicto se apoya en algo que tú abriste y puedes citar. Un «no pude comprobarlo, me falta tal dato» vale más que una opinión segura sin respaldo.

La dueña no es programadora. Los veredictos y resúmenes van en español llano; el detalle técnico va en la ficha.

## 2. Las dos versiones

| | **TIENDA** | **PRODUCTO** |
|---|---|---|
| Qué es | El sistema en vivo de Grupo MacGen: una tienda de suplementos, maquillaje y fajas, con su almacén | Lo que recibiría hoy un negocio que compre el sistema |
| Dónde está | Rama `nexora-cloud` (desplegada en Render) | La aplicación para varias empresas está en la rama `producto-nexora` (último commit `50563e46`, del 30-oct). El instalador de Windows, la página de venta y los documentos de venta se trabajan hoy en `nexora-cloud`: `instalador/`, `apps/landing/` y `docs/venta/` |
| Quién lo usa | Cajeras, vendedoras, gerente y la dueña, todos los días | Un comprador que no conoce el sistema y no tiene a la dueña ni a una IA al lado |
| Qué importa más | Cobrar rápido, que la caja cuadre, que nada sorprenda | Que se instale, se configure y se entienda solo; que no quede nada de Grupo MacGen; que dar soporte cueste poco |

Las dos ramas se separaron: `nexora-cloud` tiene más de 800 commits que `producto-nexora` no tiene, y esta tiene más de 400 propios. Varias cosas que le faltan a la tienda ya están resueltas en el producto, y al revés. Que el producto esté repartido en dos ramas es parte de lo que se te pide opinar.

Cada propuesta dice a cuál versión aplica: `tienda`, `producto` o `ambas`. Para leer la rama del producto sin cambiar de rama: `git show origin/producto-nexora:<ruta>` o `git grep -n "<texto>" origin/producto-nexora -- apps packages`. Toda cita que no sea de `nexora-cloud` se escribe `producto-nexora:archivo:línea`.

## 3. Límites

Estos no se negocian ni dependen de tu criterio:

1. **Solo lectura.** Lo único que escribes son tus documentos de respuesta y tus capturas, dentro de `docs/coordinacion/consulta-13nov/`, más la nota de entrega en tu archivo de resultados. No edites `apps/**`, `packages/**`, `tests/**`, `instalador/**`, `scripts/**`, `.github/**` ni `render.yaml`, ni siquiera para «arreglar de paso» algo que encuentres: anótalo como propuesta.
2. **Sin producción.** No despliegues, no entres a Render, no toques la base de la tienda ni credenciales, no contrates ni gastes. Tampoco abras ni midas la web en vivo: toda prueba y toda medida es en local y con datos de prueba.
3. **Las reglas de dinero no se discuten aquí**: margen = (precio − costo) / precio, sin restar ITBIS; margen mínimo 15 %; no se cambia un precio en el sistema por una oferta (el descuento lo aplica la caja). Puedes evaluar una propuesta que toca dinero; márcala `Toca dinero: sí`. Esas van a la dueña una por una.
4. **La revisión local de D12** (ayuda por rol) sigue sin publicar: no la subas, no la reconstruyas y no cites su contenido.
5. **Sin datos personales**: ni nombres de clientes o empleadas, ni teléfonos, ni cédulas, ni montos de ventas reales. Los ejemplos son inventados.
6. **Esto no autoriza construir.** Ninguna frase de este instructivo ni del catálogo es permiso para programar una mejora. Cuando se te pide «cómo lo harías», se responde con palabras: sin diff, sin prototipo y sin código en ningún worktree.
7. **Reglas de tu rutina que no aplican a esta orden**, porque es solo documentos: la regresión que falla antes y pasa después, `pnpm test:integration`, «un commit por ID», el tope de 5 commits sin revisar, la rama `nexora-chatgpt` y el PR. Aquí mandan la rama y la entrega de la sección 9. Todo lo demás de `AGENTS.md` e `INSTRUCCIONES_ACTUALES.md` sigue vigente.

## 4. Antes de empezar

1. `git fetch origin` y trabaja desde `origin/nexora-cloud`. Anota el SHA: es la primera línea de tu respuesta (`Base: <SHA>`).
2. Lee `docs/sistema/README.md` y, según tu parte, `PANTALLAS.md`, `ROLES_Y_PERMISOS.md`, `FLUJO_CAJA_POS.md`, `FLUJO_COBROS_Y_TRANSFERENCIAS.md`, `FLUJO_MERCANCIA.md` y `DATOS_Y_MODELOS.md` de esa carpeta.
3. Lee `docs/coordinacion/LEVANTAMIENTO_MEJORAS_IA_12NOV.md` y `ESTADO_MEJORAS_12NOV.md`: son las 28 mejoras ya decididas (C1 a C16 y D1 a D12). **No las vuelvas a proponer.** Si crees que una de ellas está mal planteada, dilo en el Paso 4.
4. Regla vigente de la dueña (24-oct): usa los agentes en paralelo que tengas. Un reparto que funciona: un agente por dimensión, un integrador que quita repetidos y un «abogado del diablo» que ataca tus propios veredictos antes de entregar. Dos cuidados:
   - Todos tus agentes respetan lo mismo que tú: no abren el catálogo hasta que el Paso 1 esté subido.
   - En la PC, los agentes en paralelo solo leen código. La aplicación y el navegador, de uno en uno.

## 5. Paso 1: tu lista a ciegas

**Antes de traer el catálogo**, recorre el sistema como lo haría cada persona: la cajera que cobra, la vendedora que prepara una venta, la gerente que autoriza y cierra, la dueña que revisa el día y la mercancía, y el comprador que instala el producto por primera vez. Anota las mejoras que tú harías.

- **Tiempo:** como máximo 90 minutos. Entrega lo que tengas; se esperan alrededor de 12.
- **Formato:** numeradas `N-A01`, `N-A02`… si eres nube, o `P-A01`… si eres PC. Por cada una: título, una o dos líneas, dónde lo viste (`archivo:línea` o pantalla) y a cuál versión aplica.
- **Archivo:** `docs/coordinacion/consulta-13nov/PASO1_A_CIEGAS_<NUBE|PC>.md`. **Súbelo en un commit propio y haz push antes de traer el catálogo.**
- Hasta que entregues tu respuesta completa, no abras la rama del otro agente.

Por qué: después de leer 82 propuestas ajenas vas a pensar dentro de su marco. Esta lista es la única parte de tu respuesta que no puede estar influida por Claude, y el commit previo deja el orden demostrado. Si viste el catálogo antes por error, dilo al inicio de ese archivo: no invalida tu trabajo, pero la dueña debe saberlo.

Después de abrir el catálogo, añade al final de ese mismo archivo, en un commit nuevo, esta tabla:

```
| Mía | En el catálogo | Coincidencia |
|---|---|---|
| N-A01 | COM-04 | igual |
| N-A02 | no está | — |
```

`Coincidencia` solo admite `igual`, `parecida`, `distinta` o `—`. Es el dato más útil del cruce: lo que encontraste por tu cuenta y Claude también encontró.

## 6. Paso 2: evaluar el catálogo

### 6.1 Traer el catálogo y leer la evidencia

```
git fetch origin consulta/catalogo-13nov
git show origin/consulta/catalogo-13nov:docs/coordinacion/CONSULTA_MEJORAS_CATALOGO_13NOV.md
```

No lo copies a tu rama: Norexos 1 lo integra cuando los dos hayan subido su Paso 1.

La evidencia de cada propuesta se comprobó en el commit `3705f7d8` de `nexora-cloud`. Ahí los números de línea son exactos:

```
# bash
git show 3705f7d8:apps/web/src/POS.tsx | sed -n '516,539p'
# PowerShell
git show 3705f7d8:apps/web/src/POS.tsx | Select-Object -Skip 515 -First 24
```

Tu veredicto es sobre **el código de tu `Base`**, no sobre el de ese commit. Para ver qué cambió entre los dos: `git diff --stat 3705f7d8 origin/nexora-cloud -- apps packages instalador`. Si lo que la propuesta describe ya cambió, dilo en la ficha. Si una línea no coincide, busca el texto citado cerca antes de dar la evidencia por falsa.

### 6.2 Ficha por propuesta

Evalúas las propuestas de tu grupo y las marcadas con ★ (reparto en la sección 8). Empieza por las ★ y sigue en el orden del catálogo, que va de más a menos peso dentro de cada dimensión. Una ficha por propuesta, con el mismo ID y este formato exacto, para poder cruzar las dos respuestas:

```
### EST-03 · <título del catálogo>
- **Evidencia:** confirmada | corregida | falsa | no abierta. Qué abriste (archivo:línea o comando) y, si no es «confirmada», qué es lo cierto.
- **Veredicto:** apoyo | apoyo con cambios | no la haría | falta un dato.
- **Impacto:** 1–5 · **Esfuerzo:** P | M | G · **Riesgo:** bajo | medio | alto · **Toca dinero:** sí | no · **Visto en pantalla:** sí | no
- **Respuesta a la pregunta del catálogo:** …
- **Qué cambiaría o qué haría en su lugar:** … (o «nada»)
- **Qué puede romper y qué pruebas lo cubren hoy:** …
- **Certeza:** comprobado (lo abrí o lo ejecuté) | deducido (lo razono del código) | no comprobado.
```

Escalas, para que las dos respuestas se puedan comparar:

- **Impacto.** 5: evita perder dinero o datos, ahorra tiempo en cada venta, o es requisito para vender el producto. 4: una cajera o la dueña lo nota todos los días. 3: se nota cada semana, o abarata con claridad los cambios futuros. 2: mejora menor o de casos raros. 1: cosmético.
- **Esfuerzo** (un agente, con sus pruebas y su revisión). P: hasta 1 día. M: de 2 a 5 días. G: más de una semana, o exige migrar datos o tocar varias capas a la vez.
- **Riesgo.** Bajo: presentación o código aislado y cubierto por pruebas. Medio: toca un flujo de uso diario. Alto: dinero, datos, permisos o migraciones, o no hay pruebas que lo cubran.

Reglas de la ficha:

- No des veredicto sin abrir la evidencia. Si no pudiste abrirla, la evidencia es `no abierta`, el veredicto es `falta un dato` y dices cuál.
- Un número del catálogo (líneas, cantidad de rutas, consultas, tamaños) se reproduce con el comando que usaste. Si te da otro número, pon el tuyo.
- `apoyo con cambios` y `no la haría` siempre traen la alternativa. Una objeción sin alternativa no le sirve a la dueña para decidir.
- Mira primero si existe una versión más pequeña que consiga casi lo mismo. En este proyecto se prefiere el cambio más chico que resuelve el problema.
- «Esfuerzo» y «Toca dinero» del catálogo son la opinión de Claude: corrígelos si no coinciden con la tuya.
- En las tablas y en los campos de valor fijo escribe solo los valores exactos de arriba, sin adornos: se van a cruzar con un programa.

### 6.3 A fondo

De las propuestas que evaluaste, elige **hasta 10** que valgan una orden de construcción y dales media página a cada una: cómo la harías paso a paso, qué archivos toca, si necesita migración y cómo se haría sin parar la tienda, qué pruebas faltan, cómo se comprobaría en pantalla y cómo se da marcha atrás. Con palabras; sin diff ni código. Si solo 4 lo merecen, son 4.

## 7. Pasos 3 y 4

### 7.1 Paso 3: tus propuestas (Parte B)

Parte de tu lista a ciegas y complétala. **Meta: 18 propuestas**, repartidas en esta tabla de 12 casillas (seis dimensiones por dos versiones):

| | Estructura | Diseño | Comodidad | Seguridad | Eficiencia | Modernidad |
|---|---|---|---|---|---|---|
| TIENDA | | | | | | |
| PRODUCTO | | | | | | |

- Una propuesta `ambas` cuenta para una sola casilla, la que tú elijas.
- Si en una casilla no encuentras nada con evidencia que tú abriste, escribe «nada que valga» y qué miraste. Una casilla vacía y justificada vale más que un relleno.
- Lo que el catálogo ya cubre no se repite aquí: queda anotado en la tabla del Paso 1.

Cada propuesta lleva un ID propio (`N-EST-01` si eres nube, `P-EST-01` si eres PC) y el formato del catálogo: Versión, Lo nota, Esfuerzo, Toca dinero; Hoy; Evidencia con `archivo:línea`; Propuesta; Beneficio; Riesgo; Cómo se comprobaría. Al inicio de la Parte B, una tabla con las columnas `ID | Dimensión | Versión | Impacto | Esfuerzo | Riesgo | Dinero | Certeza | Parecida a`, donde `Parecida a` es un ID del catálogo o `—`.

Además:

- **Qué quitarías o simplificarías**: hasta 5 cosas (pantallas, opciones, código, pasos) que hoy sobran o estorban. Mejorar también es quitar.
- **Si este software fuera tuyo**: las decisiones de fondo que tomarías en los próximos tres meses (hasta 5) y la que más te preocupa no tomar.
- **Modernidad, mirando afuera**: qué hacen hoy los sistemas de punto de venta modernos que este no hace y que su tipo de cliente sí notaría. Si consultas la web, cita la dirección y la fecha. Si lo dices de memoria, márcalo `de memoria, sin comprobar`. No atribuyas funciones a un competidor sin fuente.

### 7.2 Paso 4: síntesis (Parte C)

1. **Las 10 primeras** entre todo (catálogo más las tuyas), por ID, con una línea de por qué cada una.
2. **Las 5 primeras para la TIENDA** y **las 5 primeras para el PRODUCTO.**
3. **Victorias rápidas**: esfuerzo P, riesgo bajo, sin tocar dinero.
4. **Qué no hacer todavía**, y qué tendría que pasar para hacerlo.
5. **Orden y dependencias**: una secuencia de 4 semanas, sabiendo que construye un solo carril (Norexos 1), que ChatGPT PC comprueba en pantalla y que lo que toca dinero se aprueba de uno en uno.
6. **Tus desacuerdos más fuertes con el catálogo** (hasta 5). Si no tienes ninguno de fondo, dilo así.

## 8. Reparto entre nube y PC

| | **ChatGPT nube** | **ChatGPT PC** |
|---|---|---|
| Su grupo | Las propuestas con evaluador principal «nube» (casi todas las `EST`, `SEG` y `EFI`) | Las de evaluador principal «PC» (casi todas las `DIS` y `COM`) |
| Además | Las marcadas con ★ del otro grupo | Las marcadas con ★ del otro grupo |
| Cómo comprueba | Leyendo el código y ejecutando pruebas o medidas en local | En pantalla, con la aplicación en local y datos de prueba, a 1366 px y a 390 px |

El catálogo dice en cada propuesta quién es su evaluador principal y cuáles llevan ★. Las ★ las evalúan los dos: sirven para ver si coinciden.

Evalúa solo tu grupo y las ★. Sigues con el resto únicamente si Norexos 1 escribe en tu archivo de órdenes «cubre también lo del otro».

Solo para ChatGPT PC:

- Para las propuestas del instalador, de impresión o del celular: lee `instalador/` y el código, y cita lo que ya mediste en entregas anteriores. **No compiles, no instales y no imprimas para esta consulta.** La instalación limpia de Windows que tienes pendiente va aparte y después.
- Las capturas van en `docs/coordinacion/consulta-13nov/capturas/`, sin datos reales.
- Cierra navegadores y procesos (Playwright, Node, PostgreSQL de prueba) al terminar cada tanda: la PC de la dueña ya se quedó sin memoria por procesos abiertos.
- Si la aplicación no arranca por una dependencia que falta, `pnpm install --frozen-lockfile` está permitido (no cambia el repositorio). Si tras dos intentos sigue sin arrancar, evalúa por código y pon `Visto en pantalla: no`.

## 9. Entrega

- **Rama:** `chatgpt-nube/consulta-mejoras-13nov` o `chatgpt-pc/consulta-mejoras-13nov`, creada desde `origin/nexora-cloud`. Sin PR: Norexos 1 integra.
- **Archivos**, todos en `docs/coordinacion/consulta-13nov/`:
  - `PASO1_A_CIEGAS_<NUBE|PC>.md`
  - `RESPUESTA_CHATGPT_<NUBE|PC>.md`
  - `capturas/` (solo PC)
- **Primera línea de la respuesta:** `Base: <SHA de origin/nexora-cloud que evaluaste>`.
- **Encabezados fijos de la respuesta**, en este orden: `## Resumen para la dueña` · `## Tabla de veredictos` · `## Fichas` · `## A fondo` · `## Parte B: propuestas propias` · `## Parte C: síntesis` · `## Lo que no pude comprobar`.
  - `Resumen para la dueña`: 10 líneas, sin palabras técnicas, que empiecen por lo que ella notaría.
  - `Tabla de veredictos`: una fila por propuesta evaluada, con las columnas `ID | Evidencia | Veredicto | Impacto | Esfuerzo | Riesgo | Dinero | Certeza | Pantalla`.
  - `Lo que no pude comprobar`: qué quedó sin abrir o sin ver, y qué haría falta.
- **Cuatro pushes, uno por paso.** El CI corre en cada push y cancela el anterior de la misma rama, así que solo se esperan los 3 CI en verde del último. Si sale rojo por algo ajeno a tus documentos, no lo arregles ni vuelvas a empujar: anota el número de la ejecución. Las entregas parciales sirven: si te quedas sin tiempo, lo subido cuenta.
- **Aviso:** una sección nueva arriba en `docs/coordinacion/RESULTADOS_CHATGPT_NUBE.md` (nube) o `RESULTADOS_CHATGPT.md` (PC) con el SHA, el CI y qué quedó sin hacer.

Antes de entregar, revisa:

- [ ] El Paso 1 está en un commit anterior a cualquier otro archivo de la respuesta, y tiene al final la tabla de coincidencias.
- [ ] Cada ficha tiene evidencia abierta por ti (o `no abierta`), veredicto y certeza, con los valores exactos.
- [ ] Cada `falsa`, `apoyo con cambios` y `no la haría` dice qué es lo cierto o qué harías en su lugar.
- [ ] La tabla de 12 casillas de la Parte B está completa: propuesta o «nada que valga».
- [ ] Ninguna propuesta propia repite el catálogo ni C1–C16 / D1–D12.
- [ ] No hay datos personales, credenciales, código de mejoras ni contenido de la revisión local de D12.
- [ ] No cambió ningún archivo fuera de `docs/coordinacion/consulta-13nov/` y de tu archivo de resultados.

## 10. Qué pasa después

Norexos 1 cruza las dos respuestas con el catálogo. Donde las opiniones coinciden, la propuesta sube a una lista corta para la dueña. Donde no coinciden, ella recibe los argumentos de cada lado, sin que nadie los suavice. Ella decide qué se construye y en qué orden.
