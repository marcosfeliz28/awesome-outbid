// Actividad de sesión y de equipo (AuthGuard en common.ts).
//
// Antes cada petición autenticada escribía AuthSession.lastActivityAt y
// Terminal.lastActivityAt: con 4 cajas, miles de UPDATE por hora sobre las
// mismas filas, que se bloqueaban entre sí bajo carga. Ahora se escriben como
// mucho una vez por minuto.
//
// Consecuencia: la última actividad guardada de una sesión puede ir hasta un
// minuto por detrás de su última petición. Para que nadie pierda la sesión
// antes que cuando se escribía en cada petición (la web avisa «¿Sigues
// ahí?» 60 s antes de cerrarla), toda comprobación de inactividad del
// servidor (guard, /auth/refresh y el flujo de tiempo real) concede ese mismo
// minuto de margen: una sesión inactiva vive en el servidor, como mucho, un
// minuto más que el plazo; la web cierra la suya con su propio reloj.
//
// Con plazos cortos (menos de 10 minutos; el mínimo configurable es 1) un
// minuto de margen sería demasiado: ahí se sigue escribiendo en cada petición
// y el plazo es exacto, como antes.

/** Intervalo máximo entre escrituras de la actividad de un equipo. */
export const ACTIVITY_WRITE_INTERVAL_MS = 60_000;

const SHORT_TIMEOUT_MS = 10 * 60_000;

/**
 * Intervalo de escritura de la actividad de una sesión y margen que se
 * concede al comprobar su inactividad (son el mismo valor): 60 s, o 0 con
 * plazos de inactividad menores de 10 minutos.
 */
export const sessionActivityGraceMs = (timeoutMs: number) =>
  timeoutMs >= SHORT_TIMEOUT_MS ? ACTIVITY_WRITE_INTERVAL_MS : 0;

/**
 * Un equipo cuenta como «conectado» si tuvo actividad en este plazo. Debe
 * superar el intervalo de escritura: las peticiones y el flujo de tiempo real
 * la renuevan como mucho una vez por minuto.
 */
export const TERMINAL_ONLINE_MS = ACTIVITY_WRITE_INTERVAL_MS + 30_000;
