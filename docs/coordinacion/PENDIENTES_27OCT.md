# Pendientes al 27-oct-2026 (tarde)

## Para desplegar (solo Nexora 1, con 3 CI en verde)
1. `chatgpt-pc/lumina-motion-integracion` (portada del producto): `verify` en curso.
2. Cadena de diseño interior de ChatGPT nube (#16 → #11 → #13 → #14): sin CI, sobre base vieja; rebase pedido.
3. Claude PC: `pc23-anulacion-fix`, `a1-formula-utilidad`, `b01-ventas-caja-ciega` (3 CI en verde; esperan decisión de la dueña).

## Decisiones de la dueña
1. Ocultar importes en «Ventas» a la cajera con caja abierta (B-01; incluye ticket y PDF, y créditos).
2. `netProfit`/cuadre: ¿deja de restar ITBIS? (A1 no lo toca).
3. PC-23: anular un pago del medio exige anular antes los posteriores; rechazo de 13–19 dígitos con Luhn; mora reinicia.
4. Anular FS-0000008 (Pérez Sosa, prueba suya).
5. Cobros: créditos/contra entrega (~RD$ 233,050) sin cobro registrado: fecha, monto y forma de pago.
6. Transferencias del 26-oct: FS-306 y FS-300 coinciden; FS-299, 303, 305 y 302 con diferencias; cuenta Banreservas ···5237 vs captura.
7. Promociones del análisis de rotación (510 productos sin venta ≈ RD$ 1.82 M a costo).
8. Plugins: instalar tú en la laptop (hace falta el comando `claude`); OmniRoute/Headroom/claude-mem solo en VM o usuario aparte.
9. Instalador: «sí» para la prueba física en la laptop.
10. Crear entorno «Taller» sin secretos; quitar Render/Cloudflare ahí; proteger ramas en GitHub.
11. Diseño más profesional (Canva/Runway): la dueña lo trabaja; Nexora 1 recibe los datos y lo integra con ChatGPT.
12. GV reimport: espera a Clary.

## Técnicos abiertos
- Huella de Task Observer 3.8.1 en `plugins.lock.json` (espera confirmación del Taller).
- Hallazgos bajos del QA (4) y fallo previo del mock de Google Drive en Configuración.
- Cajas de hoy (Wendy y Lizbeth) abiertas: no tocar la tienda mientras estén abiertas.
