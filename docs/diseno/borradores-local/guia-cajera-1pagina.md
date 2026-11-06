> **Borrador sin verificar, hecho por modelo local (cola N34).** Fuente: docs/sistema/* de origin/nexora-cloud @ e47a557d. Revisión de Claude PC: PARCIAL: la entrada se recortó a 4000 caracteres y la salida se corta al final (apartado 2, último punto). Revisar antes de usar.

# Guía para la cajera: Flujo de caja y punto de venta

## 0. Antes de empezar

1. **Entrar a mi tienda**: En la pantalla de acceso, ingresa tu usuario o correo y tu contraseña. Luego, haz clic en el botón **«Entrar a mi tienda»** (`apps/web/src/App.tsx:468`, `:512`). La contraseña temporal se cambiará al entrar (`apps/web/src/App.tsx:548`).

2. **Aprobación del equipo**: Asegúrate de que el equipo esté aprobado. Si no lo está, aparecerá el mensaje «Este equipo necesita aprobación … un gerente debe aprobarlo: con su PIN aquí mismo o desde Configuración › Equipos» (`apps/web/src/realtime.tsx:513-516`). Sin equipo aprobado, no podrás vender ni mover mercancía (`apps/api/src/common.ts` decorador `RequireTerminal`, usado en `apps/api/src/sales.ts:1469` y `apps/api/src/cash.ts:838`).

3. **Cambiar de cajera sin salir**: En el menú de la cuenta, haz clic en **«Cambiar de usuario con PIN»** (`apps/web/src/App.tsx:1161`). No podrás cambiar con PIN a alguien con más permisos (`apps/api/src/auth.ts:845-859`).

## 1. Abrir la caja

1. **Abrir la caja**: En el menú lateral, selecciona **Caja** (`apps/web/src/App.tsx:250`).

2. **Abrir mi caja**: Si no hay caja abierta, verás el título «Una caja que siempre cuadra» y el botón **«Abrir caja»** (`apps/web/src/Management.tsx:1670-1677`), o en el centro **«Abrir mi caja»** con el texto «Tu día empieza con una caja abierta» (`:1740-1744`).

3. **Efectivo inicial**: Se abre la ventana **«Abrir mi caja»** (`:2017`). En el campo **«Efectivo inicial»** (`:2022`), el sistema sugiere lo que la misma persona dejó en su último cierre: «Sugerido: lo que dejaste en tu último cierre.» (`:2025-2028`, API `apps/api/src/cash.ts:1433-1468`).

4. **Nota si el fondo es menor que el sugerido**: Si el fondo es **menor** que lo sugerido, aparece **«Nota si el fondo es menor que el sugerido»** y es obligatoria; no pide PIN (`apps/web/src/Management.tsx:2029-2039`; `apps/api/src/cash.ts:868-885`).

5. **Guardar la apertura de la caja**: Se guarda con `POST /cash-sessions/open` (`apps/api/src/cash.ts:837-947`). Requiere permiso `cash:write`. Una persona solo puede tener **una caja abierta**; si pulsa «Abrir» otra vez devuelve la misma (`apps/api/src/cash.ts:893-908`). La caja es de quien la abre, no del equipo.

6. **Estado en el Punto de venta**: En el Punto de venta, el estado pasa de «Caja sin abrir» a **«Caja abierta»** (`apps/web/src/POS.tsx:1024-1028`). Si se intenta cobrar sin caja, aparecerá el mensaje «Abre tu caja antes de cobrar.» (`:523`); además, aparecerá el enlace **«Abre tu caja para comenzar»** que lleva a Caja (`:1218-1221`).

7. **Caja abierta en otro equipo**: Si la caja quedó abierta en **otro equipo**, aparecerá el mensaje «Tu caja está abierta en «…». Para cobrar aquí, trasládala a este equipo o ciérrala en el otro.» con el botón **«Trasladar caja aquí»** y la ventana «Trasladar caja a este equipo» (botón **«Trasladar caja»**; pide PIN de gerente según el caso) (`apps/web/src/realtime.tsx:629-668`; API `apps/api/src/cash.ts:1061-1111`).

## 2. Abrir el Punto de venta y elegir cliente

1. **Abrir el Punto de venta**: En el menú, selecciona **Punto de venta** (`apps/web/src/App.tsx:209`). Título «Punto de venta» (`apps/web/src/POS.tsx:902`).

2. **Selecciona el cliente**: El cliente es **obligatorio**. Haz clic en el botón **«Selecciona el cliente»** con la leyenda «Elegir cliente · F4» (`:1033-1051`; atajo F4 `:567-571`). Si se pulsa «Cobrar» sin cliente, se abrirá la ventana con el aviso «Selecciona o crea el cliente antes de cobrar.» (`:517-521`).

3. **¿Para quién es esta venta?**: Ventana **«¿Para quién es esta venta?»** (`:1318`): buscar por «Nombre, teléfono o cédula» (`:1420`); Enter elige el primero si es único (`:1426-1441`). «Consumidor final» sale primero si existe (`:360-377`). Si no está, haz clic en **«Nuevo cliente aquí mismo»** (`:1474-1477`) → formulario «Nombre del cliente *», «Teléfono», «RNC o cédula», «Correo electrónico» → **«Guardar y usar cliente»** (`:1354-

Qué hice:
- Revisé y redacté los pasos para la cajera basados en la guía proporcionada.

Qué NO comprobé:
- No revisé el contenido de `apps/web/src/POS.tsx:1354-` ya que el texto se cortó.

