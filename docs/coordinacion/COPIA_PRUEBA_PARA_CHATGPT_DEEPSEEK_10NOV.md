# Copia de prueba de Norexos POS para ChatGPT y DeepSeek (10-nov)

Para: Norexos 1
De: Claude PC
Rama: `claude-pc/copia-prueba-10nov` (informe base: `docs/coordinacion/COPIA_PRUEBA_CLAUDE_PC_10NOV.md`, commit `de3b2725`)

## Estado

La copia de prueba está arriba en la laptop de Marcos, solo en localhost. Usa la base PostgreSQL local vacía, con migraciones y semilla demo. La IA de ventas está apagada.

- Web: `http://localhost:5173`
- API: `http://127.0.0.1:3001/api`
- Usuarios de prueba: `cajera.test`, `gerente.test`, `admin.test`, `duena.test`, `gerente.sucursal-b`. Las claves se entregan a Marcos por chat; no van en este archivo.

## Lo que ChatGPT y DeepSeek necesitan saber

1. **No pueden entrar a localhost.** Los chats web de ChatGPT y DeepSeek no ven `localhost` de la laptop. Hay tres opciones:
   - a) Pegarles el paquete público y las rutas (sin código completo) y que describan los ataques; Marcos o Claude PC ejecutan las pruebas en localhost y devuelven los resultados.
   - b) Que Marcos ejecute la copia en su máquina y les dé acceso con un túnel. Esto no está preparado; no lo he levantado.
   - c) Que ChatGPT o DeepSeek trabajen con el código en un agente local.
2. **DeepSeek:** es un servicio de una empresa china y puede conservar lo que se le pegue. Recomendación de `PRUEBA_DE_INTRUSION_10NOV.md`: darle solo el paquete público y las rutas, no el código completo, salvo decisión de la dueña.
3. **Claves de prueba:** usar solo las cuentas de prueba de la copia. No pegar en ningún chat claves ni contraseñas reales de Norexos.
4. **Riesgo abierto:** la API escucha en `0.0.0.0:3001` porque `apps/api/src/main.ts:79` lo fija así. Para que solo sea localhost hay que cambiarlo a `127.0.0.1`, en un commit aparte que decide Norexos 1. Hasta entonces, cualquier equipo de la misma red puede alcanzar la API (no el resto de la tienda).

## Pendiente de decisión (Norexos 1)

- ¿Opción (a), (b) o (c) para ChatGPT y DeepSeek?
- ¿Cambiamos el bind de la API a `127.0.0.1` en un commit aparte?

No he enviado nada a ChatGPT ni a DeepSeek. No he tocado la tienda en vivo ni Render.
