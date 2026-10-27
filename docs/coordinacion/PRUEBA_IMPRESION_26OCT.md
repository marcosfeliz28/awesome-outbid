# Prueba de impresión térmica · 26-oct-2026

## Resultado

**BLOQUEADO:** esta laptop no tiene una impresora térmica instalada ni detectada. Por eso no se imprimieron el cierre de caja ni el ticket con NCF en 80 mm o 58 mm.

## Comprobaciones realizadas

Se consultaron, sin modificar el sistema:

- `Get-Printer`
- `Get-CimInstance Win32_Printer`
- dispositivos presentes de clase `Printer` y nombres habituales de impresoras POS/térmicas mediante `Get-PnpDevice -PresentOnly`

Windows solo devolvió impresoras virtuales:

- OneNote (Desktop)
- Microsoft Print to PDF
- Fax
- AnyDesk Printer

No apareció una impresora física, un controlador térmico ni un puerto asociado a una impresora de recibos.

## Pendiente para completar P4

Conectar e instalar la impresora térmica real y repetir con papel físico:

1. ticket de venta con NCF en 80 mm;
2. cierre/cuadre de caja en 80 mm;
3. ticket de venta con NCF en 58 mm;
4. cierre/cuadre de caja en 58 mm;
5. fotografiar cada papel completo y registrar cualquier corte, salto, columna truncada o desborde.

No se desplegó nada, no se usó producción y no se modificó Render.
