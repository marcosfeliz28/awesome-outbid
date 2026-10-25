# N-15 · Conector MCP con OAuth, primera versión de solo lectura

**24 de octubre de 2026 · rama de producto · no desplegado**

## Qué permite

Un administrador de una empresa puede autorizar durante **una hora** a un cliente MCP previamente registrado para consultar dos herramientas: `ventas_hoy` (número de facturas completadas y total facturado de su sucursal) y `stock_bajo` (máximo 20 variantes activas bajo su mínimo). No expone datos personales de clientes ni datos de otra empresa. El permiso se revoca al cerrar la sesión del administrador, cambiar su contraseña/versión de acceso, desactivar su usuario o retirar el cliente de la lista permitida. Las lecturas quedan en bitácora y se hacen en una transacción `READ ONLY` con RLS por empresa.

La sección «Bandeja de cambios propuestos» muestra **0** y avisa que los conteos y entradas están desactivados. No hay herramientas MCP para crear, editar ni borrar. La decisión del 19 de octubre de la dueña sigue vigente.

## Activación técnica para un piloto aislado

El conector está apagado por defecto y solo existe con `PRODUCT_TENANCY=required`. Para un piloto de producto, el operador configura en el servidor, fuera del repositorio:

- `PRODUCT_MCP_ENABLED=enabled`.
- `APP_PUBLIC_URL` con el origen HTTPS público desde el que se sirve la PWA y se reenvía `/api` a NestJS.
- `MCP_TOKEN_SECRET`: valor aleatorio de al menos 32 caracteres, separado del secreto normal de sesiones.
- `MCP_OAUTH_CLIENTS`: JSON con hasta 20 clientes. Cada uno tiene `id`, `name` y una lista de `redirectUris` **exactos**; solo HTTPS (HTTP se admite únicamente en localhost para pruebas). Ejemplo ficticio: `[ { "id": "cliente-ia", "name": "IA del negocio", "redirectUris": ["https://cliente.example/callback"] } ]`.

El cliente usa la URL MCP `https://<origen>/api/mcp`, la autorización `https://<origen>/mcp/autorizar` y el canje `https://<origen>/api/mcp/oauth/token`. Hay metadatos en `/api/mcp/oauth/metadata`. La autorización exige código de un solo uso de 5 minutos, PKCE S256 y `scope=read`. El usuario ve el nombre y retorno validados antes de aceptar. Solo una cuenta con permiso `*` puede aprobar.

## Alcance y límites antes de ofrecerlo

Las direcciones de retorno se registran por el operador; **no** hay registro dinámico de clientes ni descubrimiento automático en `/.well-known` del dominio de la PWA. Se debe configurar manualmente un cliente que permita introducir los endpoints OAuth. Tampoco hay refresh token: después de una hora hay que volver a autorizar. Las pruebas verifican JSON-RPC MCP básico (`initialize`, `tools/list`, `tools/call`); falta una prueba de compatibilidad con el cliente MCP comercial que elija cada negocio.

Una página de estado de la PWA no prueba que el cliente MCP pueda conectarse desde otra red. Antes de activar un piloto real, verificar proxy HTTPS, consentimiento en navegador, canje, revocación y registros desde el cliente elegido. No se usó la base ni la API de la tienda.
