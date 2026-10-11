# Qué revisar en Render sin cambiar la configuración

Guía de consulta para la dueña. Cambios de planes, discos, base de datos, variables o despliegues pueden costar dinero o interrumpir ventas. **No pulses Save, Deploy, Restore, Delete ni cambies valores sin aprobación de la dueña y soporte.**

## Recursos declarados por el proyecto

El archivo render.yaml de esta rama declara:

| Recurso | Declaración del repositorio | Qué significa para esta revisión |
| --- | --- | --- |
| Web nexora-pos-web | 0.5c-512mb | Plan escrito en el Blueprint; no demuestra el plan en vivo ni su costo actual. |
| API nexora-pos-api | 1c-2g | Plan escrito en el Blueprint; no demuestra el estado del servicio. |
| PostgreSQL nexora-pos-db | 0.5c-1g, disco 5 GB | Valores declarados para la base. |
| Autoescalado del almacenamiento | false | No está activado en el archivo. No lo cambies desde una guía. |
| Despliegue automático | apagado | El archivo declara despliegue manual. |

Estos nombres de plan son los que aparecen en el archivo, no una cotización. El panel **Billing** y los detalles actuales del servicio son la fuente del precio real. Un cambio puede reiniciar servicios o aumentar la factura. Para una propuesta de cambio, compara el plan de la pantalla con este archivo y con el precio oficial de Render antes de pedir aprobación.

## Revisar recuperación de PostgreSQL

1. En el Dashboard de Render, abre nexora-pos-db y consulta **Recovery**.
2. Anota el plan de workspace, la hora más antigua disponible para **Point-in-Time Recovery (PITR)** y si hay exports lógicos. No ejecutes **Restore Database** ni descargues datos de clientes para compartirlos.
3. Las ventanas publicadas por Render al **10-oct-2026** son 3 días para workspace Hobby y 7 días para Pro o superior; las bases Free no tienen estas capacidades. Los exports lógicos se conservan 7 días. Verifica la ventana que muestre tu pantalla, porque depende del plan y puede cambiar.
4. Un PITR crea otra base; no significa que la recuperación se haya probado. La política del proyecto indica validar en una instancia nueva antes de cambiar la conexión de la aplicación.

## Revisar el almacenamiento

- Confirma la capacidad y uso del disco de nexora-pos-db; el Blueprint declara 5 GB.
- El autoescalado de almacenamiento está desactivado en render.yaml. Render permite configurar el autoescalado de almacenamiento de Postgres, pero el crecimiento puede generar cargos y el disco no se puede reducir de nuevo. No lo habilites sin una decisión de la dueña y una actualización revisada del Blueprint.
- No confundas el disco de PostgreSQL con un disco persistente adjunto a un servicio web; son recursos diferentes.

## Comprobar la privacidad del repositorio

En GitHub, abre el repositorio y consulta **Settings** → **General** → **Danger Zone / Change repository visibility** sin pulsar el botón de cambio. Si aparece como público, avisa a la dueña: hay informes técnicos de seguridad que no deberían quedar expuestos. No cambies la visibilidad sin su aprobación, porque puede afectar accesos e integraciones.

## Fuentes y alcance

Los valores declarados proceden de render.yaml; esta guía no verifica el panel ni el estado en vivo. Documentación oficial consultada el 10-oct-2026: [planes de Render](https://render.com/pricing), [recuperación y respaldos de PostgreSQL](https://render.com/docs/postgresql-backups), [discos persistentes](https://render.com/docs/disks) y [especificación de Blueprint](https://render.com/docs/blueprint-spec). Si la pantalla y el archivo difieren, detente y pide una revisión; no sincronices el Blueprint por tu cuenta.
