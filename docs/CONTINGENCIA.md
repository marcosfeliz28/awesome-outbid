# Plan de contingencia de la tienda (imprimir y pegar junto a la caja)

**Objetivo:** seguir vendiendo y no perder ninguna venta si falla internet,
Render (la nube donde vive Nexora) o el servidor de Nexora.

## Contactos (llenar a mano)

| Quién                   | Nombre              | Teléfono / WhatsApp |
| ----------------------- | ------------------- | ------------------- |
| Dueña / administración  |                     |                     |
| Técnico de Nexora       |                     |                     |
| Proveedor de internet   |                     |                     |
| Contador (dudas de NCF) |                     |                     |
| Estado de Render        | `status.render.com` | —                   |

## Preparar una sola vez (la dueña)

1. **Decidir si se vende sin conexión.** Viene apagado. Se activa en
   **Configuración › Negocio y reglas › Editar configuración › «Permitir ventas
   sin conexión»**. Con varias cajas, dos equipos sin conexión pueden vender la
   misma última unidad; al volver internet hay que revisar esos conflictos.
2. Cada caja tiene la app **instalada** y abierta al menos una vez después de
   cada actualización (así guarda la app y el catálogo en el equipo).
3. En la caja hay un **talonario de facturas manuales numeradas** y una hoja de
   control (hora, cajera, artículos, monto, forma de pago, cliente). Preguntar
   al contador cómo manejar los NCF en contingencia.
4. Datos móviles de respaldo: un celular con _hotspot_ o un segundo proveedor.
5. Monitor que avisa por Telegram o SMS en 1–2 minutos: ver
   [MONITOREO.md](MONITOREO.md).
6. Copia de los datos fuera de Render, descargada cada semana: ver
   [RESTAURACION_RENDER.md](RESTAURACION_RENDER.md).
7. **Sistema anterior:** decidir si se deja instalado y con licencia durante
   el piloto como plan B. **Instalador local de Nexora:** sólo en una laptop
   de reserva, apagada, para el «modo isla» de abajo (ver
   [INSTALADOR.md](INSTALADOR.md)); nunca en las cajas conectadas a la nube.

## Durante la falla: diagnosticar en 2 minutos

| Lo que se ve                                                                                            | Causa probable                 | Qué hacer                                                                                                                          |
| ------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Nada abre en ningún equipo, pero el celular **con datos móviles** sí abre `nexora-pos-web.onrender.com` | Internet de la tienda          | Conectar las cajas al _hotspot_ del celular. Si no se puede: vender sin conexión (si está activado) o con talonario.               |
| Tampoco abre con datos móviles, o la barra dice **Sin conexión** en todas las cajas                     | Render o el servidor de Nexora | Mirar `status.render.com` y llamar al técnico. Cajas con sesión abierta: vender sin conexión (si está activado). Si no: talonario. |
| Abre, pero cobrar da «No se pudo completar» varias veces                                                | La base de datos está caída    | No insistir. Talonario y anotar. Avisar al técnico.                                                                                |
| Se fue la luz                                                                                           | —                              | Talonario. Las laptops con batería siguen si hay internet o _hotspot_.                                                             |

**Regla de oro:** si no sabes si una venta se registró, consúltala; nunca la
cobres otra vez por intuición.

## Según cuánto dure

- **Menos de 30 min:** sin conexión o talonario. **No cerrar sesión ni
  reiniciar** los equipos (sin internet no se puede volver a entrar).
- **30 min a 4 h:** seguir igual. El técnico revisa en Render los eventos y el
  último despliegue; si el problema empezó con una actualización, usa
  _Rollback_ al despliegue anterior.
- **Más de 4 h, o Render caído en toda la región:** el técnico decide si
  enciende la laptop de reserva con la última copia (**modo isla**) y las
  cajas trabajan contra ella en la red de la tienda. Todo lo vendido ahí se
  vuelve a registrar después en la nube, con una lista y una persona
  responsable.
- **Datos perdidos o dañados en la nube:** el técnico sigue
  [RESTAURACION_RENDER.md](RESTAURACION_RENDER.md).

## Al volver la conexión

1. Abrir cada caja con su usuario. Las ventas guardadas en el equipo se envían
   solas, sin duplicarse. Revisar **Caja › Ventas guardadas en este
   dispositivo** y resolver las que digan **Requiere revisión**.
2. Pasar las ventas del talonario al sistema, una por una, y anotar en cada
   hoja el número de factura del sistema.
3. Cuadrar la caja y contar los artículos vendidos durante la falla.
4. El técnico anota: causa, duración y ventas afectadas.
