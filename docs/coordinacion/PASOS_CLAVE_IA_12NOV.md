# Cómo encender la IA de Norexos: pasos para la dueña (12-nov-2026)

**Tiempo: unos 10 minutos. Solo la dueña puede hacerlo**, porque la clave va atada a su cuenta y a su forma de pago. Nadie más debe verla: no se pega en chats, correos ni documentos, y no se le entrega a ningún agente.

Fuentes comprobadas el 12-nov: documentación de Render sobre variables de entorno, documentación de la consola del proveedor (claves y límites de gasto) y el código de `nexora-cloud`.

## 1. Qué se enciende con la clave

| Función | Dónde está | Modelo | Costo estimado |
|---|---|---|---|
| Preguntar a Norexos | Menú «Preguntar a Norexos» | Haiku 5.5 (el económico) | Menos de US$0.003 por pregunta |
| Leer la factura del proveedor por foto o PDF | Mercancía | Opus 5.5 | Entre US$0.05 y US$0.15 por factura; tope técnico cerca de US$0.35 |

La lectura de facturas se enciende sola con la misma clave: no tiene interruptor aparte. Tiene un tope de 30 lecturas por usuaria al día.

Gasto máximo de «Preguntar a Norexos» si todas usaran todas sus preguntas todos los días (ejemplo con 5 usuarias y 26 días al mes):

| Plan | Preguntas por usuaria al día | Máximo al mes |
|---|---|---|
| `medio` | 10 | menos de US$4 |
| `completo` | 30 | menos de US$10 |

Son estimados. Salen de los límites que el código pone a cada pregunta y de los precios publicados por el proveedor (los mismos que usa el medidor del sistema). El gasto real se ve en Configuración › Uso de IA.

## 2. Crear la clave

1. Entrar a `platform.claude.com/settings/keys` con la cuenta de la dueña. Si es la primera vez, la consola pedirá crear la cuenta y poner saldo o una forma de pago; el monto mínimo no se pudo comprobar.
2. Pulsar **Create key**.
3. Nombre: `Norexos tienda`.
4. **Expiration:** elegir **Never**. Con una fecha, la IA se apaga sola ese día.
5. **Linked account:** el usuario de la dueña.
6. **Workspace:** elegir uno, por ejemplo el «Default». Si la clave queda sin workspace, el sistema da error al usarla.
7. Copiar la clave (empieza con `sk-ant-api`) y tenerla a mano solo hasta terminar el paso 4.

## 3. Poner un límite de gasto (recomendado)

1. Entrar a `platform.claude.com/settings/spend-limits`.
2. Junto a **Monthly spend limit**, pulsar **Set limit** (o **Adjust limit**).
3. Escribir `20`.

Con eso la IA no puede gastar más de US$20 al mes. Al llegar al límite la IA deja de responder hasta el mes siguiente o hasta subir el límite; vender, cobrar y cerrar caja siguen igual porque no dependen de la IA.

## 4. Guardar la clave en Render

1. Entrar a `dashboard.render.com` y abrir el servicio **nexora-pos-api**.
2. En el menú de la izquierda, pulsar **Environment**.
3. Pulsar **+ Add Environment Variable**. Nombre: `ANTHROPIC_API_KEY`. Valor: la clave. Si la variable ya aparece en la lista, editar su valor.
4. Agregar o editar otra variable. Nombre: `IA_VENTAS_PLAN`. Valor: `medio` o `completo`.
5. En el botón de guardar, abrir el menú y elegir **Save only**.
6. Avisar a Norexos 1: «clave puesta».

**Importante:** no elegir «Save and deploy» ni «Save, rebuild, and deploy». Esas opciones reinician el sistema en ese momento y pueden cortar una venta. Con «Save only» la clave queda guardada y se activa en el siguiente despliegue.

## 5. Lo que hace Norexos 1 después

1. Con la tienda cerrada y sin cajas abiertas, despliega `nexora-pos-api` para que tome la clave.
2. Comprueba que «Preguntar a Norexos» responde y que el medidor registra el uso.
3. Lo confirma a la dueña.

## 6. Cómo apagarla

- Vaciar `IA_VENTAS_PLAN` apaga «Preguntar a Norexos» (se activa en el siguiente despliegue).
- En `platform.claude.com/settings/keys`, **Disable** apaga todo al instante y se puede volver a encender con **Re-enable**.

## 7. Decisiones pendientes de la dueña

- Plan `medio` o `completo`.
- El tope de US$0.40 por usuaria al día del asistente analista (función nueva, todavía sin mezclar).
