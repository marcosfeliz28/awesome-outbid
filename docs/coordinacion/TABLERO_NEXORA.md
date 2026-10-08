# Tablero de coordinación Nexora · Claude + ChatGPT

Sirve para que dos asistentes trabajen sin pisarse. Se actualiza en cada entrega. Quien termina algo lo anota aquí con el commit.

## Reglas

1. **Una sola rama de despliegue: `nexora-cloud`.** Render despliega de ella a mano (autoDeploy apagado).
2. **ChatGPT escribe el código** en la rama `nexora-chatgpt` (o entrega ZIP si no puede empujar). **Claude audita** cada entrega con agentes que intentan refutarla, y sólo entonces la fusiona en `nexora-cloud`.
3. **Un solo desplegador a la vez: Claude** (tiene el conector de Render). ChatGPT no despliega sin avisar en este tablero. Orden fijo: primero `nexora-pos-api`, después **siempre** `nexora-pos-web` (la web fija la IP de la API al arrancar; ver N2).
4. **Nadie edita un archivo que el otro tiene reservado** (tabla de abajo). Para tocarlo, se anota aquí primero.
5. **Cada corrección lleva una regresión que falla antes y pasa después**, con la salida pegada. `pnpm check` en verde antes de entregar.
6. **Sin secretos** en el repo, en reportes ni en mensajes. Sin datos de producción. Pruebas destructivas sólo en base descartable.
7. **La dueña decide** lo que cambia reglas del negocio (límites de crédito, PIN, claves de las cajas). Se pregunta; no se asume.
8. El tablero y la cola se leen **antes** de empezar y se actualizan **al terminar**.

## Reserva de archivos

| Quién | Archivos |
|---|---|
| ChatGPT | apps/api/src/**, apps/web/src/**, packages/shared/**, prisma/migrations (nuevas), tests/** |
| Claude | docs/coordinacion/**, docs/AUDITORIA_* , deploy/render/** y render.yaml (cuando ChatGPT necesite cambiarlos lo pide aquí), despliegues en Render |
| Instalador (ChatGPT) | instalador/**, docs/INSTALADOR.md |

## Estado de Render (Claude lo actualiza)

| Servicio | Commit en vivo | Nota |
|---|---|---|
| nexora-pos-api | c0b7105 | migraciones 202610130001 y 202610130002 aplicadas |
| nexora-pos-web | c0b7105 | |
| nexora-pos-db | PostgreSQL 17 | cerrada a conexiones externas (correcto) |

## Pendiente de la dueña (nadie más puede hacerlo)

- Ejecutar en la pestaña Shell de nexora-pos-api el comando de `PASOS_RENDER_PARA_LA_DUENA.txt` para marcar las cajas con clave de 4 dígitos.
- Cambiar las credenciales del expediente de auditoría.
- Decidir las reglas marcadas «DECIDE LA DUEÑA» en la cola.

## Entregas

| Fecha | Quién | Qué | Commit | Auditado por | Resultado |
|---|---|---|---|---|---|
| 2026-10-08 | ChatGPT | Correcciones de la auditoría 2 (N1, A06–A12) | c0b7105 | Claude | N1 mal: ver L1 |
