# Quién hace qué: Norexos 1 y Norexos 2 (orden de Marcos, 19-nov-2026)

Marcos: «Norexos 1 es software, desarrollo y reparación. Norexos 2 es mercancía: entrar, cotizar, consulta y así sucesivamente.» Cada tarea tiene un solo dueño. Si algo cae en el otro lado, se pasa por mensaje (send_message) y no se hace «de paso».

## Norexos 1 (software, desarrollo y reparación) — sesión nube coordinadora
- Código de la tienda (rama `nexora-cloud`) y del producto en línea (`producto-nexora`): arreglos, funciones nuevas, pruebas, CI (los 3: verify, windows-installer, render-images).
- Despliegues en Render (tienda y nube de venta), migraciones, rollback, salud del sistema, seguridad, auditorías de código.
- Coordinación con ChatGPT/Dot (PC y nube): órdenes, revisión de sus ramas, publicación. Claude no diseña (regla 4).
- Agentes, revisores (dinero/seguridad), skills y reglas del repositorio.
- Fotos y datos del sistema como software (cargar el mecanismo, no decidir el stock).
- Usuarios, permisos y equipos (terminales) como configuración del software.
- Herramientas y programas para que Norexos 2 trabaje (APIs, scripts como mercancia.py, reportes). N1 construye la herramienta; N2 la usa con los datos.

## Norexos 2 (mercancía y operación del negocio)
- Mercancía: entradas, salidas, traspasos Casa↔Tienda, ajustes, conteos, regalos, facturas de proveedores, devoluciones a proveedor — siempre con el skill `mercancia` (verificar ×3, conteos ×4, aplicar solo con el sí de la dueña) y la bitácora `docs/operacion/bitacora-mercancia.jsonl`.
- Cotizar, consultas de precios/costos/stock y preguntas de la dueña sobre mercancía o ventas.
- Cuadre de cajas y cobros del día (transferencias, créditos, bancos, volantes) según la orden de Marcos del 19-nov. Cualquier dato de dinero del negocio que se corrija en el sistema lo ejecuta N2 con la confirmación de la dueña.
- Estado diario para la dueña (transferencias por verificar, cierres, pendientes de mercancía).

## Reglas de frontera
1. N1 no cambia datos del negocio (mercancía, precios, cobros, cajas). Si hace falta mover un dato, N1 prepara la herramienta o la consulta y lo ejecuta N2 con el sí de la dueña. (Excepción solo si la dueña ordena a N1 directamente, como el traslado de los RD$ 5,000 de FS-0000706 el 19-nov; se anota en la bitácora.)
2. N2 no toca código, ramas, CI ni Render. Si ve un fallo del sistema, se lo manda a N1 con el caso exacto.
3. Antes de desplegar N1 pide a N2 la cuenta de cajas abiertas (0 requerido).
4. Dudas de quién es: se pregunta a Marcos en una línea, no se adivina.
5. Reglas de dinero de CLAUDE.md valen para los dos (margen sin restar ITBIS, mínimo 15 %, la caja aplica el descuento).
