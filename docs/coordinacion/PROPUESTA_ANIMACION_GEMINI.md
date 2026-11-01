# Pedido de propuesta: animación y didáctica de Norexos (para Gemini)

Hola. Te pedimos una propuesta sobre qué animar y cómo, en la app de Norexos (punto de venta e inventario para tiendas de suplementos, maquillaje y fajas en República Dominicana). No hay que cambiar código: propón y razona.

## Contexto que debes respetar

- Repositorio: `awesome-outbid`, web en `apps/web/src/`. Estilos en `apps/web/src/styles.css`. Tokens de movimiento en `packages/ui/src/tokens.css`: `--nx-dur-fast` 120 ms, `--nx-dur-base` 180 ms, `--nx-dur-slow` 240 ms, `--nx-ease-out` cubic-bezier(0.2, 0.8, 0.2, 1).
- Reglas duras de la dueña:
  - Solo CSS nativo, animando únicamente `transform` y `opacity`, con duración máxima de 240 ms.
  - `prefers-reduced-motion` debe apagar todo.
  - NADA en el punto de venta (POS), carrito, cobro, teclas F2/F4/F8/F12, teclado, impresión de facturas ni la «caja ciega».
  - NADA en Gv (GV Makeup Studio: cursos, citas, pagos). Otro agente trabaja ahí.
  - Sin lógica nueva, sin cambios de API, sin cálculos de dinero ni claves de almacenamiento.
- Ya están hechas: entrada (login), tablero (KPIs, franja y alertas) y reportes/desglose del mes.
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

Entrega, en español:

1. **Propuesta priorizada**: las 10 ideas en orden, con una frase de razón cada una, pensando en cajera, vendedora y dueña.
2. **Secuencia de implementación**: en qué orden hacerlas para que cada paso sea pequeño, probable y reversible (una rama por pantalla).
3. **Didáctica**: para cada pantalla, qué texto corto de ayuda pondrías y dónde, en español sencillo.
4. **Accesibilidad y desempeño**: riesgos de legibilidad, contraste, movimiento y laptops lentas, y cómo los medimos.
5. **Ideas nuevas**: hasta 5, que cumplan las reglas duras. Indica pantalla y clase CSS.
6. **Tabla final**: columnas *idea | prioridad (1–3) | esfuerzo (bajo/medio/alto) | riesgo (bajo/medio/alto) | archivo principal | ¿requiere JavaScript? (sí/no)*.

Sé concreto y corto. Si no sabes algo del código actual, dilo en vez de suponerlo.
