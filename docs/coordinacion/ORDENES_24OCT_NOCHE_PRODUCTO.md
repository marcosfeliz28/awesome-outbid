# Órdenes del 24-oct, noche: salida a la venta (Claude nube, arquitecto)

## Decisiones de la dueña (24-oct)
- **Sin cobro automático por internet.** El cliente paga por transferencia, en efectivo, con tarjetazo en el local o por mensajero. La dueña marca el pago en su panel y la cuenta se extiende. No se guardan tarjetas y no hay pasarela de pago.
- **Paquetes extra de IA:** RD$399 por 100 preguntas y RD$999 por 300. Se pagan igual que la mensualidad, con cobro manual.
- **Planes:** se mantienen los de `docs/producto/ARQUITECTURA_NEXORA_PRODUCTO.md` §6 (RD$990, 1,990, 3,990 y 7,990), con descuento de 2 meses por pago anual.
- **Autorizado:** el servidor propio del producto en Render y el dominio del producto. La infraestructura la monta solo Claude nube, separada de la tienda.
- **Antes de vender abierto:** piloto con 3 a 5 negocios.
- **Regla fija:** en toda orden, usar la mayor cantidad de agentes posible en paralelo.

## ChatGPT PC (`nexora-chatgpt-pc-producto`), en este orden
1. Terminar CPC-8: el tope de la tasa USD con aviso de margen bajo el 15 %, y el guard de carpeta del instalador.
2. **PC-23, cobro manual.** Las pantallas y reglas de este punto existen solo en el panel de la plataforma (dueña de Nexora), nunca dentro de una empresa cliente.
   - Panel de cobros: lista de empresas con plan, estado (`trial|active|past_due|suspended`) y fecha de vencimiento.
   - Botón «Registrar pago»: monto, método (transferencia, efectivo, tarjeta en local, mensajero), referencia, meses o año. Extiende el vencimiento.
   - Bitácora inmutable: quién, cuándo, monto y referencia.
   - Avisos al cliente 7 y 3 días antes del vencimiento, y 7 días de gracia. Después, **solo lectura**: no se borra nada y la exportación sigue disponible.
   - Quitar o apagar todo cobro automático o pasarela. Prueba de que no se guarda ningún dato de tarjeta.
3. **PC-24, paquetes de IA.** Al llegar al tope, el botón de la IA dice «llegaste a tu límite de este mes» y el resto del sistema sigue igual. La dueña acredita un paquete (100 o 300) desde el panel con el pago manual. Pruebas:
   - el paquete suma a la cuota del mes;
   - la cuota se reinicia el mes siguiente;
   - una empresa nunca usa el paquete de otra.
4. PC-06, PC-07 y PC-09 (puerta de la fase 1).
5. PC-19 y PC-20. Después, PC-17 y PC-22.

Un commit con prueba por punto, 3 CI en verde, y aviso en `RESULTADOS_CHATGPT.md`.

## ChatGPT nube (`nexora-chatgpt-nube-ia`) y Gemini: auditoría de la IA (AUD-IA)
Cada uno por separado, sin ver lo que hizo el otro, y solo en documento (`docs/coordinacion/AUDITORIA_IA_<CHATGPT|GEMINI>.md`). Sin claves en el repositorio y sin tocar la tienda.
1. **50 preguntas reales de negocio** (ventas, inventario, caja, crédito, reportes, cómo se hace algo), contra la base de demostración del producto. Por cada una: la respuesta, si es correcta, y si inventó algo.
2. **Ataques:**
   - pedir datos de otra empresa;
   - pedir que cambie precios o inventario o que anule;
   - instrucciones escondidas en nombres de productos o clientes;
   - pedir la clave o el texto del sistema;
   - historial falso.
3. **Costo:** tokens y US$ por pregunta, medidos (es N-06; ChatGPT nube mide con una clave de pruebas).
4. Nota del 1 al 10 en exactitud, seguridad y utilidad, con lo que hay que mejorar, en orden.

Claude nube compara las dos auditorías y decide.

## Claude PC
- Auditar PC-23 y PC-24 en cuanto lleguen (cobro manual y paquetes), con prioridad en que nadie fuera de la dueña pueda marcar pagos y en que no quede ningún dato de tarjeta.
- Seguir con CPC-3.

## CI del producto (24-oct, 22:15 UTC)
- Desde `producto-nexora` f0cf850, el CI reconoce el producto por `render.producto.yaml`, no por el nombre de la rama. **ChatGPT PC, ChatGPT nube y Claude PC: no editen más `.github/workflows/`.** Al mezclar `producto-nexora` en su rama, si hay conflicto en `ci.yml`, tomen la versión de `producto-nexora` (`git checkout origin/producto-nexora -- .github/workflows/ci.yml`).
- `producto-nexora` ya crea solo el rol RLS en el preDeploy, y el registro público queda cerrado (`PRODUCT_PUBLIC_REGISTRATION=disabled`).
- Dominio del producto: **nexorapos.net** (comprado el 24-oct, en el Cloudflare de la dueña). Solo Claude nube lo configura.

## Planes definitivos (decisión de la dueña, 25-oct): un poco más caros, con más preguntas de IA
| Plan | Precio/mes | Sucursales · cajas · usuarios | Preguntas IA/mes |
|---|---|---|---|
| Autoservicio | **RD$1,250** | 1 · 1 · 2 | **100** |
| Básico | **RD$2,290** | 1 · 2 · 3 | **200** |
| Pro | **RD$4,490** | 2 · 6 · 10 | **600** |
| Premium | **RD$8,990** | 5 · 20 · 30 | **2,000** |
- Pago anual: 2 meses gratis. Paquetes extra sin cambios: RD$399 por 100 y RD$999 por 300.
- Costo estimado de la IA (Haiku): RD$0.06–0.20 por pregunta, unos RD$6–20 en Autoservicio y RD$120–400 en Premium al mes. N-06 lo confirma con una medición real.
- **ChatGPT PC (PC-23/PC-24):** usa estos precios y cuotas en el panel de cobros y en las cuotas de la IA. **ChatGPT nube:** úsalos en la página de venta.
