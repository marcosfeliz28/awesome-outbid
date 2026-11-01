# Pedido de punto de vista: animación y didáctica de Norexos (para DeepSeek)

Hola. Te pedimos tu punto de vista sobre qué animar y cómo, en la app de Norexos (punto de venta e inventario para tiendas de suplementos, maquillaje y fajas en República Dominicana). No hay que cambiar código: solo propón y razona.

## Contexto que debes respetar

- Repositorio: `awesome-outbid`, web en `apps/web/src/`. Estilos en `apps/web/src/styles.css`. Los tokens de movimiento están en `packages/ui/src/tokens.css`: `--nx-dur-fast` 120 ms, `--nx-dur-base` 180 ms, `--nx-dur-slow` 240 ms, `--nx-ease-out` cubic-bezier(0.2, 0.8, 0.2, 1).
- Reglas duras de la dueña:
  - Solo CSS nativo, animando únicamente `transform` y `opacity`, con duración máxima de 240 ms.
  - `prefers-reduced-motion` debe apagar todo.
  - NADA en el punto de venta (POS), carrito, cobro, teclas F2/F4/F8/F12, teclado, impresión de facturas ni la «caja ciega».
  - NADA en Gv (GV Makeup Studio: cursos, citas, pagos). Otro agente trabaja ahí.
  - Sin lógica nueva, sin cambios de API, sin cálculos de dinero ni claves de almacenamiento.
- Ya están hechas: entrada (login), tablero (KPIs, franja y alertas) y reportes/desglose del mes (tarjetas, periodo, top 10 y filas).
- La didáctica debe ser en español sencillo, revisable por la dueña.

## Lo que proponemos (las ideas de la dueña)

1. Inventario y mercancía (`Merchandise.tsx`, `InventoryImport.tsx`): filas que entran en escalón, búsqueda y filtros que se deslizan, parpadeo suave en la fila guardada.
2. Configuración y administración (`Management.tsx`): secciones que entran una por una, tarjetas de ajustes que se expanden con altura y opacidad.
3. Incentivos (`Incentives.tsx`): lista en escalón, pistas que aparecen con fade. Solo presentación.
4. Avisos y alertas (`alerts-list`, `alert-row`, `dashboard-alert`, `alert-counter`): los avisos nuevos entran desde la derecha; el contador rebota una vez.
5. Estados vacíos (`empty-small`): fade e ícono con leve movimiento, como invitación y no como error.
6. Pistas didácticas (`form-hint`, `login-hint`, `cod-hint`, `incentive-hint`): aparecen con retraso al enfocar el campo.
7. Transiciones entre secciones del menú: fade corto (≤ 240 ms).
8. Hover e íconos: elevación de 2 px en botones y tarjetas; ícono que se mueve un poco al pasar el cursor.
9. Recorrido de primera vez (3 a 5 pasos, saltable, una sola vez). Requiere JavaScript y recordar «ya lo vio».
10. Números que cuentan y gráficos que se dibujan (`KpiStrip`, `MonthReport`, `PaymentMixPie`, `YearPie`). Requiere JavaScript.

## Lo que necesitamos de ti

Responde en este orden, en español, con tabla al final:

1. **Tu ranking** de las 10 ideas, de mayor a menor valor para una cajera, una vendedora y la dueña. Justifica cada posición en una frase.
2. **Riesgos**: qué idea podría romper algo (legibilidad, rendimiento en laptops viejas, accesibilidad, mareo por movimiento, tiempos de respuesta) y cómo mitigarlo.
3. **Ideas que faltan**: propón hasta 5 ideas nuevas que sí cumplan las reglas duras. Di qué pantalla y qué clase CSS tocarían.
4. **Ideas que quitarías**: cuáles sobran o confunden, y por qué.
5. **Una prueba por idea**: qué verificaríamos (ejemplo: que solo se animen `transform`/`opacity`, que la duración sea ≤ 240 ms, que `prefers-reduced-motion` la apague).
6. **Tabla final**: columnas *idea | prioridad (1–3) | esfuerzo (bajo/medio/alto) | riesgo (bajo/medio/alto) | archivo principal | ¿requiere JavaScript? (sí/no)*.

Sé concreto y corto. Si algo no lo sabes sobre el código actual, dilo en vez de suponerlo.
