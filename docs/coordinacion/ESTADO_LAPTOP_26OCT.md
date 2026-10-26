# Estado de la laptop compartida · 26-oct-2026

Fecha y alcance: inspección de solo lectura realizada el 26-oct. No se instaló,
desinstaló, detuvo ni eliminó nada durante esta revisión. La tienda en Render no
fue consultada ni modificada.

## Respuesta corta

1. **No puedo atribuir la desinstalación a ChatGPT PC.** En los registros de
   trabajo que tengo no aparece un comando de desinstalación ni la ejecución de
   un desinstalador de FitStore. La evidencia actual sí confirma que
   `C:\Program Files\FitStore POS` ya no existe. No es correcto afirmar quién lo
   borró sin el registro del actor o del instalador.

2. **No hay evidencia de una instalación nueva terminada.** El trabajo de
   compilación anterior validó las fuentes, pero no produjo ni verificó un
   `FitStore-POS-Setup-*.exe` ejecutable. Hoy no encontré ese instalador en
   Descargas, Escritorio o Documentos, ni una entrada de desinstalación de
   FitStore/Nexora POS en el registro. El Visor de eventos contiene errores de
   PostgreSQL del 25-oct que intentan cargar
   `C:\Program Files\FitStore POS\runtime\postgresql\...`, ruta que ya falta.
   Esto es compatible con una instalación anterior retirada o incompleta, pero
   no prueba que el instalador nuevo haya terminado. No encontré un log de NSIS
   o de FitStore que dé un resultado final.

3. **El proceso del puerto 3001 sí es mío y es temporal; PostgreSQL 5432 no lo
   es.**

   - Puerto `3001`: `node.exe` PID `10468`, iniciado desde
     `C:\Users\marco\Downloads\nexora-gv-test`, para la prueba local de GV.
     Usa PostgreSQL embebido en `127.0.0.1:5444` (PID `41140`) y Vite en `5173`
     (PID `49792`). Se deben apagar los tres al cerrar esta prueba, pero **no se
     apagaron en esta orden de solo lectura**.
   - Puerto `5432`: servicio independiente `postgresql-x64-18`, inicio
     automático, cuenta `NT AUTHORITY\NetworkService`, binario
     `C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe`, datos en
     `C:\Program Files\PostgreSQL\18\data`. No fue creado ni usado por la
     prueba GV; no lo apagué ni recomiendo apagarlo sin que la dueña confirme
     para qué lo necesita.

4. **Lo que queda hoy en la laptop:**

   - No hay servicios llamados `FitStoreAPI`, `FitStorePostgreSQL` ni
     `FitStoreWeb` visibles en el inventario de servicios.
   - Falta `C:\Program Files\FitStore POS` y no existe la carpeta pública vieja
     de respaldos `C:\Users\Public\Documents\FitStore Backups`.
   - Persiste la carpeta vacía o sin contenido visible
     `C:\ProgramData\FitStore POS` (creada el 07-oct; última escritura
     registrada el 25-oct a las 09:40).
   - Permanecen los procesos locales temporales de GV indicados arriba y el
     PostgreSQL 18 independiente en 5432.
   - Los errores del Visor de eventos del 25-oct muestran intentos de un
     PostgreSQL que aún referencia la ruta ya inexistente de FitStore; es una
     señal de estado incompleto que se debe diagnosticar antes de instalar nada.

5. **Para terminar una instalación nueva falta, antes que nada, una decisión y
   una base limpia controlada.** Hace falta que la dueña confirme si esta laptop
   se libera como VM/PC limpia para PC-18 y PC-22, y que indique si el
   PostgreSQL 18 de 5432 se conserva o puede aislarse. Después se necesita un
   instalador `.exe` compilado, con hash comprobado, su log de ejecución, y una
   prueba completa en una base local nueva: instalación, primer arranque,
   crear empresa, venta, impresión/cajón si existe la térmica y desinstalación.
   No se debe reutilizar la instalación incompleta ni tocar 5432 hasta contar
   con esa decisión. También hace falta que Claude PC confirme por separado si
   él ejecutó la desinstalación o un instalador el 25-oct.

## Evidencia consultada

- Servicios y entradas de desinstalación de Windows: sin coincidencias FitStore.
- Puertos en escucha: 3001, 5173 y 5444 corresponden al ensayo GV local;
  5432 corresponde a `postgresql-x64-18` independiente.
- Rutas: ausente `C:\Program Files\FitStore POS`; presente
  `C:\ProgramData\FitStore POS`; ausente la carpeta pública de respaldos.
- Visor de eventos, 25-oct: PostgreSQL informa que no puede abrir
  `C:/Program Files/FitStore POS/runtime/postgresql/share/timezone[s]` porque
  la ruta ya no existe.
- No se encontró un `FitStore-POS-Setup-*.exe` en las carpetas locales revisadas
  ni un log concluyente de instalación de FitStore.

## Actualización tras «Aclarado por la dueña»

La desinstalación de la versión vieja era necesaria para liberar la laptop y
no hay nada que recuperar. Con esa aclaración, el estado de la **instalación
nueva** es: **no terminó; no hay evidencia de que haya llegado a ejecutarse**.

- **Registro disponible:** no apareció un log de NSIS/FitStore que indique una
  instalación nueva exitosa, fallida o interrumpida. El único registro técnico
  relacionado es el Visor de eventos de PostgreSQL del 25-oct, que intenta
  abrir la ruta ya ausente `C:\Program Files\FitStore POS\runtime\postgresql`.
  Es evidencia de restos de la instalación retirada, no de un instalador nuevo
  completado.
- **Qué falta para PC-18 y PC-22:** un `FitStore-POS-Setup-*.exe` verificable
  (incluido su SHA-256), su ejecución en esta laptop libre y el log resultante;
  luego completar el guion de Windows limpio con capturas: instalación, primer
  arranque, empresa, venta, impresión/cajón si hay térmica y desinstalación.
- **Siguiente acción autorizada:** continuar PC-18/PC-22 sólo cuando esté el
  instalador verificable. No corresponde inferir una instalación exitosa ni
  reutilizar restos de la anterior.

## Actualización nocturna: artefactos para mañana

- **No se instaló nada.** Después de cancelar/cerrar el aviso de elevación no
  existen `C:\Program Files\Nexora POS Local`,
  `C:\ProgramData\Nexora POS Local` ni servicios `NexoraLocal*`.
- **Producto local preparado:** se generó y verificó
  `Nexora-POS-Local-Setup-0.1.1.exe` (90,622,757 bytes, SHA-256
  `5FC5648DBF64CEEE4D62D39F63B171A51EE2D56B38EF0E5FFF04589278E3347D`).
  Está sin firma, que es el pendiente PC-17 conocido. Su ejecución se aplaza
  hasta que la dueña esté presente mañana para aceptar UAC y registrar cada
  pantalla.
- **BLOQUEADO para PC-22:** el instalador separado de la tienda no llegó a
  generarse. `instalador/build.ps1 -SoloPreparar` falla con salida 1 en
  `instalador/tools/verify-deploy-lock.mjs:76`: rechaza
  `@fitstore/shared@file:///C:/Users/marco/Downloads/nexora-pc22-prep/packages/shared`
  como «Directorio externo al workspace verificado». Es una falla cerrada del
  empaquetado; no se produjo `.exe` de tienda ni se ejecutó instalador alguno.
