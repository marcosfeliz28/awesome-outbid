# N1 · Estabilización de dos pruebas antiguas

**Fecha:** 26 de octubre de 2026

**Rama:** `chatgpt-nube/pruebas-estables`

**Alcance:** sólo archivos de pruebas; no se cambió código productivo.

## Correcciones

### Venta offline y apertura de caja

`tests/pago-dolares-api.test.ts` ya no usa el reloj local inmediatamente después de que PostgreSQL fija `openedAt`. Construye `capturedAt` como `openedAt + 1 ms`, espera de forma determinista hasta que ese instante no sea futuro y comprueba explícitamente que la captura sea posterior a la apertura.

Esto elimina la carrera de milisegundos sin ampliar ventanas, cambiar la regla de negocio ni aceptar una captura anterior a la caja.

### Purga y envío de Telegram

`tests/telegram.test.ts` detiene la API principal con Telegram antes de sembrar el aviso de la prueba. La instancia sin Telegram no puede reclamarlo y se inicia una sola API con Telegram para ejecutar la purga. La aserción comprueba que el servidor falso exclusivo recibió exactamente un `sendMessage` con el texto esperado.

Esto elimina la competencia entre trabajadores; no se salta el worker ni se reemplaza el envío real por una escritura directa.

## Evidencia

- Caso (h) de pago en dólares: **5/5** repeticiones aprobadas.
- Purga de Telegram aislada: **10/10** repeticiones aprobadas.
- ESLint, Prettier y `git diff --check`: aprobados.

Comandos focales:

```bash
pnpm exec vitest run --config vitest.integration.config.ts \
  tests/pago-dolares-api.test.ts -t '\(h\)'

NEXORA_TEST_SKIP_API_CHECK=1 pnpm exec vitest run \
  --config vitest.integration.config.ts \
  tests/telegram.test.ts -t 'la purga'
```

## Autoauditoría

Una primera propuesta todavía permitía que otro trabajador consumiera el aviso de Telegram y fijaba la captura exactamente en la frontera de apertura. Una revisión independiente reprodujo 3 fallos en 31 ejecuciones de Telegram. Esos dos defectos se corrigieron en commits posteriores, aislando el trabajador y exigiendo una hora estrictamente posterior.

Pendiente de cierre: los tres trabajos del CI del último commit deben terminar en verde. No se desplegó ni se tocó Render.
