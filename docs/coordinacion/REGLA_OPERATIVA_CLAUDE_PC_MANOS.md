# Regla operativa permanente (orden de la dueña, 27-oct-2026)

**La dueña solo interviene en lo que las sesiones no pueden hacer** (decisiones de dinero/negocio, cuentas y claves, permisos del sistema, pagar, firmar). Todo lo demás se resuelve entre sesiones:
1. **Nexora 1 (cerebro) le da a Claude PC las instrucciones completas y detalladas**, por escrito en `docs/coordinacion/RESPUESTA_CLAUDE_PC_27OCT.md` (o el archivo de la orden), con el texto EXACTO a enviar a cada chat.
2. **Claude PC ejecuta con ChatGPT PC y ChatGPT nube desde la laptop** (app de ChatGPT, con la dueña presente solo para permisos de pantalla): pega las instrucciones, vigila, responde dudas de proceso, resume y reporta en el repositorio.
3. **Si un chat de ChatGPT está ocupado o abierto con otra tarea, Claude PC abre un CHAT NUEVO** dentro del proyecto correcto («ChatGPT PC» o «ChatGPT nube»), con un nombre claro (`<carril>-<tema>`, p. ej. `V-visual-fase1`, `R-bundle`) y pega ahí el texto. No interrumpe tareas en curso.
4. **No se manda a la dueña lo que Claude PC puede hacer.** Se le pregunta solo lo imposible de delegar, en una línea y con recomendación.
5. Nexora 1 revisa lo que llega con `LISTA:` + 3 CI en verde y despliega (única sesión con llaves). Nadie más despliega ni toca Render.
6. Límites de Claude PC que siguen valiendo: no escribe contraseñas ni claves, no borra de forma permanente, no instala sin aprobación, no envía mensajes en nombre de la dueña fuera de este flujo, no despliega.
