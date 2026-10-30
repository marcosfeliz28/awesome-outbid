# Traspaso de Mercancía (Norexos 2) — 30-oct-2026

Para la sesión nueva que releve a Norexos 2. Sin credenciales. Lee primero `CLAUDE.md`, `AGENTS.md`, skills `mercancia`, `ordenes-duena`, `informe-triple`, `pensar-antes`.

## Rol
Soporte diario con información del sistema: entradas/salidas de inventario, ventas, cuadres de caja, traspasos, incentivos, verificación de bancos. Español, corto, resultado primero. La dueña escribe seco desde el celular.

## Reglas vigentes de la dueña
- CLAUDE.md 3: margen = (precio − costo)/precio sin restar ITBIS, mínimo 15 %; no cambiar precios por ofertas; no tocar lo que ella contó o modificó ayer u hoy sin conteo nuevo suyo.
- CLAUDE.md 6: todo cambio de suplementos/maquillaje/fajas se verifica 3 veces (conteos 4) antes y después; se muestra y se aplica con su confirmación. Skill `mercancia`.
- Salidas del sistema («sácalo»): sin preguntar, razón «salida», **sin líneas en la bitácora** (orden repetida 3 veces).
- «Cerrar» una factura = cobrada (ya tenemos el dinero). Si era prueba → anular.
- «Verificar» un pago lo decide la dueña; yo solo propongo con evidencia (monto + fecha + referencia/nombre).
- Antes de preguntarle algo: buscar en bitácora, PENDIENTES-DUENA y chat (skill `ordenes-duena`). Una sola pregunta A/B con mi supuesto.
- Cifras, listas y totales: skill `informe-triple` (3 lecturas, sin filtrar primero, decir qué NO comprobé).
- No escribir reglas permanentes si ella no lo ordena. Nunca repetir credenciales.
- Solo Norexos 1 despliega. Durante el despliegue nocturno no cambiar cobros ni abrir cajas.

## Cómo entrar al sistema
`python3 docs/coordinacion/claude-nube/entrar.py` (usa NEXORA_CLAUDE_USER / NEXORA_CLAUDE_PASSWORD del entorno) → token en `/tmp/nexora_tok`. API: `https://nexora-pos-web.onrender.com/api`. Respuesta vacía o 401 = token vencido, volver a entrar (nunca leerlo como «no hay datos»). Fechas del API en UTC; hora RD = UTC−4. Mercancía: `mercancia.py ajuste|traspaso|nota|buscar` (escribe la bitácora sola).
Endpoints de cobros: `/sales/:id/payments/:pid/correct-method`, `/payments/:id/correct-transfer|verify|unverify|move-cash-session`, `/sales/:id/cod-collections`, `/sales/:id/void`, `/cash-sessions/:id/close|descuadre`.

## Hecho (todo en `bitacora-mercancia.jsonl`, 312 líneas al 30-oct)
- Cuadres 26, 27, 28 y 29-oct; cajas de Wendy (26, 27 sin ventas, 28) y Lizbeth cerradas. Estado al 30-oct 08:00 UTC: 59 cajas, 0 abiertas.
- FS-312 cash→card 2,500 (Lizbeth 27-oct); FS-77 cerrada cobrada; FS-8 anulada (prueba).
- Verificadas con constancia: FS-318, 308, 316, 317, 319, 322, 331, 332, 335, 337, 339, 341 (esta última por supuesto, ver pendientes).
- 30-oct con herramientas nuevas (`ajustes3010`): FS-328 cash→transfer Banreservas 7,800 verificada; FS-288 devuelta a «por verificar»; FS-304 tarjeta movida a la caja de Wendy (caja temporal de Claude 73d90ec9 queda +2,600 explicada).
- Entradas inventario 28-oct (Excel GP Store, 57 u.). Salidas por vencimiento/consumo: hechas, sin bitácora por orden de la dueña.
- Incentivos Lizbeth (25-oct) y pago final de Fari (borradores en scratchpad de la sesión anterior, no en el repo).
- Usuario de Clary creado; PIN de la dueña cambiado (no se anotan valores).

## Pendiente
1. **FS-336** (Edilena, 4,550, Banreservas): verificar — la dueña dijo «mañana».
2. **FS-24** (5,650, BHD, Fari, 14-oct): sin verificar; falta estado BHD ···0015 del 13–15 oct.
3. **12 transferencias del 25-oct** (FS-257…265, 278, 285, 292 = 20,550; FS-288 aparte): falta estado Banreservas/Popular del 25-oct.
4. **65 transferencias sin verificar = 242,540** (desde 11-oct, muchas con referencia placeholder). Recontar con `informe-triple` antes de citar.
5. **FS-341**: depósito de 3,000 (Renzo Joel) asignado por supuesto; la nota decía efectivo (dif. 150/400).
6. **Cuadre de Wendy**: corregido con las herramientas del 30-oct (efectivo dif 0; tarjeta +250 envío; transferencia −7,500 que es artefacto porque el cierre solo contó 2,200). Queda el recordatorio en PENDIENTES-DUENA de pasar cobros «efectivo» que fueron transferencia (mismo método que FS-328).
7. **countedCard de Lizbeth 27-oct**: digitó 117000 en vez de 11,700; el cierre no se puede editar; quedó explicado en la resolución y en la bitácora (FS-312). Propuesta de aviso en `PROPUESTA-AVISO-CIERRE-TARJETA.md`.
8. **Cuentas por cobrar** (~12 facturas crédito/COD de clientes grandes): recalcular con `informe-triple`; la dueña dirá cuáles se cobraron.
9. **Fari**: la dueña debe decidir pagar 5,775 ahora o 6,975 (incentivo pendiente ~1,200), la regla de incentivo de cursos, y revisar con contador la deducción de 5,650. Neto actual 125 (o 175 si 5,600).
10. Otros: 8,200 de la terminal GV (dinero va a Génesis, FS-340), Addison 13,900, cuenta Popular ···3620 a nombre de GGVG SRL, FS-302 (100 pesos), Clary Excel/citas/reto de GV.

## NO tocar sin conteo o confirmación nueva de la dueña
- Lo que ella contó o modificó ayer/hoy (CLAUDE.md 3); inventario contado en el Excel del 28-oct.
- Verificar pagos sin evidencia propia (3 señales: monto, fecha, referencia/nombre). Dos cuentas BHD ···0015 (MacGen y Génesis) son distintas.
- Cajas cerradas (no se editan; se explican en `descuadre`). No abrir cajas ni cambiar cobros durante el despliegue nocturno.

## Verificación de la bitácora (30-oct)
Revisada contra lo hecho en la sesión: están FS-312, 328, 288, 304, 339, 341, 336 (como pendiente), 73d90ec9, cierres de Wendy, entradas del 28-oct, cuadres 28/29. **Huecos conocidos:** (a) las salidas (Isopure, Gold Standard 5 lb ISO100, creatina ON 60 serv., productos vencidos) no tienen línea por orden de la dueña; (b) no hay línea propia para el cierre de la caja de Wendy del 28-oct más allá de la nota de cuadre; (c) FS-24 no aparece (sin cambios hechos). No pude comparar contra el sistema línea por línea en esta pasada.
