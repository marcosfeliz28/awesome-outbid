# Área 10 — Documentación y afirmaciones

- **Base auditada:** `origin/nexora-cloud` @ `cf6f7022ab9682db45327558e5dd18946a7b1473`.
- **Alcance:** instrucciones de instalador y coincidencia de afirmaciones del asistente NSIS con el validador de instalación; lectura estática y `pnpm exec vitest run tests/afirmaciones.test.ts`.
- **Prueba:** 1 archivo, 4 pruebas aprobadas. Esto valida frases prohibidas de un conjunto de documentos, pero no comprueba que las instrucciones operativas coincidan con lo que hace el instalador.

## Hallazgos

| ID | Severidad | Evidencia | Qué pasa / reproducción mínima | Propuesta (no aplicada) | Prueba que debería fallar hoy |
|---|---|---|---|---|---|
| DOC-01 | BAJO · **SIN REPRODUCIR** | `docs/INSTALADOR.md:33-34`; `instalador/installer/FitStore.nsi:242-246`; `instalador/scripts/Install-FitStore.ps1:48` | La guía dice escoger PIN de 4 a 6 dígitos. El asistente NSIS también deja pasar longitudes 4, 5 o 6 aunque su mensaje afirme que exige seis; después, el script de instalación requiere exactamente seis (`^\d{6}$`). Con un PIN de 4 o 5 caracteres el usuario puede completar la pantalla inicial, pero la instalación termina en error de validación. Se demuestra la discordancia leyendo los validadores, pero no se ejecutó el instalador de Windows, por eso queda sin reproducir en runtime. | Unificar los tres puntos en exactamente 6 dígitos: ajustar texto y validación temprana del NSIS y mantener la validación del script; agregar test del contrato que compruebe que 4/5 se rechazan en el asistente y 6 se acepta en ambos. | Prueba automatizada del contrato de PIN: falla hoy al encontrar 4–6 aceptados en NSIS o texto de guía que permite PIN corto; pasa cuando ambos validadores exigen seis. |

## Lo que está bien comprobado

- `tests/afirmaciones.test.ts` pasa sus cuatro pruebas para el conjunto de documentos/UI que escanea en esta revisión. La prueba no inspecciona todos los manuales ni verifica el comportamiento del instalador.
- La guía advierte que el instalador es un servidor local separado de la base cloud y que no es un cliente nativo conectado a Render (`docs/INSTALADOR.md:1-8`).

## No verificado

- Instalación, reparación, actualización, rollback y restauración en Windows real; por tanto, DOC-01 no está reproducido como sesión completa de instalación.
- Exactitud de las demás instrucciones operativas de red, certificados y respaldos; requieren validar cada flujo en el entorno Windows/equipos destino.

