# Dónde poner cada cosa (12-nov-2026, actualizado por Norexos 1)

Regla de oro: **cada agente solo lee su archivo.** Si la orden no está en su archivo, no la verá.
Nadie despliega, gasta ni toca Render, dinero o credenciales sin la orden directa de la dueña.

| Quién | Dónde se pega o se pone la orden | Dónde responde |
|---|---|---|
| **Claude PC** (laptop, IA local) | `docs/coordinacion/RESPUESTA_CLAUDE_PC_27OCT.md`, sección «Orden 123». En su sesión: `git pull` de `nexora-cloud` y decirle «lee la Orden 123». | Misma sección, y rama `claude-pc/ayuda-local-12nov` |
| **ChatGPT PC** (Windows real) | `docs/coordinacion/ORDENES_CHATGPT_PC.md`, sección «Cola 12-nov (2)». En el chat: pegar «Lee Cola 12-nov (2) en ORDENES_CHATGPT_PC.md de nexora-cloud y ejecútala». | `docs/coordinacion/RESULTADOS_CHATGPT.md`, rama `chatgpt-pc/instalacion-limpia-12nov` |
| **ChatGPT nube** (textos) | `docs/coordinacion/ORDENES_CHATGPT_NUBE.md` (ya tiene su pieza D12) | `RESULTADOS_CHATGPT_NUBE.md` |
| **Claude nube (N1)** | Este chat | `ESTADO_MEJORAS_12NOV.md` |
| **La dueña** | Los 3 pasos de abajo | Decirle a N1 «hecho» o la decisión |

## Lo que solo la dueña puede hacer o decidir
1. **Clave de IA en Render** (cuando decida): `PASOS_CLAVE_IA_12NOV.md`, con «Save only» para no reiniciar durante ventas. Antes, decir **plan medio o completo**.
2. **Autorizar** (sí/no): tope de US$0.40 por usuario al día para el asistente analista; cliente genérico «Consumidor final» (C1); publicar la revisión D12 local de ChatGPT PC en el repositorio público.
3. **Dinero** (uno por uno, con un «sí» explícito a cada código): C2, C3, C4-2, C10, D6, D8, D10-3.
**Despliegue:** solo con 3 CI verdes en el commit exacto, 0 cajas abiertas y una prueba real de instalación en Windows 10/11. Hoy falta esa prueba.

## Orden de trabajo de hoy
1. Claude PC: ejecuta la cola de la IA local (ayuda de la cajera) → rama `claude-pc/ayuda-local-12nov`.
2. ChatGPT PC: instalación gráfica limpia en Windows 10/11 + comprobar C6 y C15 en pantalla.
3. Norexos 1: C1 (retomar el cobro después de elegir cliente), luego C11, C13, C14*, D5, D11. (*C14 bloqueada sin webcam física.)
