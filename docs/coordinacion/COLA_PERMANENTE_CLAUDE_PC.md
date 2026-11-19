# Cola permanente de Claude PC (orden de la dueña, 31-oct-2026): la PC NUNCA para

**Regla única:** Claude PC no termina un turno, ciclo ni sesión sin tener la siguiente pieza en marcha. Si no hay orden nueva en `RESPUESTA_CLAUDE_PC_27OCT.md`, toma la **primera pieza PENDIENTE** de esta cola. No espera a Claude nube, no pregunta, no escribe «no hay nada». Solo para si la dueña dice «stop».

**Cada pieza:** una rama `claude-pc/pq-<n>`, prueba que falla antes y pasa después (o evidencia verificable si es documento), `pnpm pre-empuje`, 3 CI verdes en el SHA exacto, línea `LISTA:` en `LISTA_CLAUDE_PC.md` (claude-pc/cola2-26oct). Marca la pieza aquí como HECHA con el SHA. Una sola pieza a la vez por rama; no dos piezas tocan el mismo archivo.

**Prohibido sin orden escrita de Nexora 1:** cambiar lógica de dinero, caja, API o migraciones; mezclar en `nexora-cloud`/`producto-nexora`; desplegar; tocar mercancía o datos; credenciales. Lo que dude → lo anota en LISTA como «DUDA:» y pasa a la siguiente pieza (no se detiene).

**Reposición automática:** cuando queden menos de 10 PENDIENTES, Claude PC añade 10 nuevas **antes** de seguir, sacadas de: hallazgos de `docs/auditoria/*`, `PENDIENTES_NOCHE_30OCT.md`, `grep -rn "TODO\|FIXME" apps packages`, pruebas `skip`/intermitentes, pantallas sin captura o sin prueba, cobertura baja, dependencias atrasadas (`pnpm outdated`). Escribe en el encabezado «repuestas N el <fecha>». Si Nexora 1 ya repuso, no duplica.

| # | Pieza | Estado |
|---|---|---|
| 1 | Animación/didáctica, pantalla Entrada (orden 98) | PENDIENTE |
| 2 | Animación/didáctica, Tablero | PENDIENTE |
| 3 | Animación/didáctica, Reportes y desglose | PENDIENTE |
| 4 | Animación/didáctica, GV | PENDIENTE |
| 5 | Animación/didáctica, Inventario | PENDIENTE |
| 6 | Animación/didáctica, Configuración | PENDIENTE |
| 7 | Login: letra 16 px y foco visible en campos (auditoría 31-oct) | PENDIENTE |
| 8 | Explicar/silenciar 400 de /api/auth/refresh sin sesión (si es del cliente) | PENDIENTE |
| 9 | Migración a zod 4 (desde `claude/zod4-estudio`) | PENDIENTE |
| 10 | Cazar pruebas intermitentes: cada spec e2e 5 veces, arreglar las que fallen | PENDIENTE |
| 11 | Quitar código muerto (`formatDOP` sin uso, imports huérfanos) | PENDIENTE |
| 12 | Auditoría axe por pantalla (accesibilidad) con informe y arreglos de presentación | PENDIENTE |
| 13 | Medir letra por pantalla (≥16 px base, ≥14 px mínimo) con script y arreglar desvíos | PENDIENTE |
| 14 | Manual de usuario «Cajera» con capturas (docs/manual/) | PENDIENTE |
| 15 | Manual de usuario «Gerente» con capturas | PENDIENTE |
| 16 | Manual de usuario «Dueña» con capturas | PENDIENTE |
| 17 | Preguntas frecuentes (20) sacadas de PANTALLAS.md y GLOSARIO.md, con cita por script | PENDIENTE |
| 18 | Estados vacíos con explicación y botón, pantalla por pantalla (solo presentación) | PENDIENTE |
| 19 | Textos de ayuda (tooltips) en español sencillo para botones nuevos, revisables | PENDIENTE |
| 20 | Pruebas faltantes de `gv-money.ts` (casos borde, solo pruebas, sin cambiar código) | PENDIENTE |
| 21 | Pruebas faltantes de `assistant.ts` (T33) en rama aparte | PENDIENTE |
| 22 | Cobertura: lista de los 10 archivos de apps/api con menos pruebas y 1 prueba nueva por cada uno | PENDIENTE |
| 23 | `pnpm outdated`: actualizar dependencias menores una por rama con CI | PENDIENTE |
| 24 | Peso de JS por pantalla: informe y propuesta de carga diferida (sin aplicar lógica) | PENDIENTE |
| 25 | Revisión N+1 y falta de índices en consultas de reportes: solo informe con propuesta | PENDIENTE |
| 26 | Pasada seguridad-20 sobre `nexora-cloud` (informe, sin cambios) | PENDIENTE |
| 27 | `npm audit`/`pnpm audit`: informe y arreglos seguros | PENDIENTE |
| 28 | Cabeceras HTTP de seguridad del sitio web: informe y propuesta para `deploy/render` | PENDIENTE |
| 29 | Datos de demostración (script de semilla ficticio) para vender el producto | PENDIENTE |
| 30 | Guía de instalación/onboarding de una empresa nueva (multiempresa) | PENDIENTE |
| 31 | Textos de landing en español (hero, 3 beneficios, precios como opciones) | PENDIENTE |
| 32 | Capturas de todas las pantallas para la landing (sin datos reales) | PENDIENTE |
| 33 | Modo oscuro de lectura: solo informe de viabilidad con tokens | PENDIENTE |
| 34 | Repetir `auditoria-usuario` con DevTools en la laptop (pantallas con sesión si hay credenciales) | PENDIENTE |
| 35 | Inventario de la palabra «Nexora» restante (clases A/B/C/D de la orden 96) y cambios clase A | PENDIENTE |
| 36 | Revisar `docs/sistema/*` contra el código real tras el rediseño (citas y capturas) | PENDIENTE |
| 37 | Pruebas de móvil 320/390 px por pantalla (desbordes) con capturas | PENDIENTE |
| 38 | Atajos de teclado: lista visible en la ayuda (solo presentación) | PENDIENTE |
| 39 | Revisión ortográfica en español de todos los textos visibles (informe + arreglos) | PENDIENTE |
| 40 | Simplificar `styles.css` duplicado tras el rediseño (sin cambiar apariencia, con capturas antes/después) | PENDIENTE |
