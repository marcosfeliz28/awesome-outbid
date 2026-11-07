# Para vender Norexos hoy: qué leer y qué falta

## 1. Contrato (ya redactado, para que lo leas y valides)
- `01_CONTRATO_SERVICIO_SAAS.md`: contrato principal (26 cláusulas + hoja de contratación). Cita las leyes dominicanas (Código Civil, Ley 172-13 datos personales, Ley 358-05 consumidor, Ley 32-23 factura electrónica, Ley 126-02 firma electrónica, Código Tributario).
- `05_CONDICIONES_DE_COBRO.md`: cobro, ITBIS, mora, suspensión.
- `PUNTOS_PARA_ABOGADO.md`: 20 puntos que un abogado dominicano debe confirmar. Es un borrador hecho por IA: **no lo firmes con un cliente sin que lo revise un abogado**.
- Los campos entre corchetes `[COMPLETAR]` y `PENDIENTE` son datos tuyos: nombre legal, RNC, domicilio, precios, plazos.
- Pendiente de mezclar en esta carpeta (están en el repo, docs/venta/contrato/): 02 Política de privacidad, 03 Acuerdo de encargado, 04 Términos de IA.

## 2. Precios que recomiendo (decides tú)
El instalador pone el servidor en la laptop del cliente: no tiene costo de hosting, así que se vende distinto a la nube.

| Opción | Precio | Por qué |
|---|---|---|
| **Instalado en su laptop** (1 sucursal, hasta 3 cajas) | US$349 pago único + US$99/año de actualizaciones y soporte | Sin costo de nube; margen alto |
| **Nube Medio** (1 sucursal, 5 cajas, 10 usuarios) | US$69/mes (antes 59) | A US$59 el margen era 11.5 %, bajo tu mínimo de 15 %; a 69 es 24 % |
| **Nube Completo** (3 sucursales, 10 cajas, 25 usuarios) | US$119/mes | Margen 35–56 % |
| Nube Básico US$29 | **No ofrecerlo** hasta compartir hosting entre clientes (pierde dinero) | Estudio de costos |
| Instalación y carga de inventario | US$150 / 250 / 400 (opcional) | Propuesta anterior |
Margen = (precio − costo) / precio, sin restar ITBIS. Falta que tu contador confirme la tasa de ITBIS (16 % vs 18 %).

## 3. Qué más falta para vender hoy
1. Instalador: bajar el `.exe` del CI `windows-installer` en verde y probarlo en una laptop Windows 11 limpia (instalar, abrir, vender, respaldo). Lo prueba Claude PC / ChatGPT PC; yo reviso el resultado.
2. Firmar el instalador (certificado de código) o avisar al cliente del aviso de Windows; si no, parece sospechoso.
3. Datos legales tuyos: nombre/sociedad, RNC, domicilio, correo y dominio de soporte (norexos.net vs .ai: unificar).
4. Abogado dominicano revisa el contrato (puntos 4–8 primero).
5. Decidir moneda de cobro (USD o RD$) y cómo cobras (transferencia, tarjeta).
6. Aclarar al cliente que Norexos **no emite NCF/e-CF** (cláusula 13); si lo prometen en venta, hay riesgo legal.
7. Landing: decisiones pendientes (planes, precios, soporte) y publicar en norexos.net.
8. Manual corto y soporte por WhatsApp listo.
