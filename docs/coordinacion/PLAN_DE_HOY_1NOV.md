# Plan de hoy (1-nov-2026) — instrucciones por área (Norexos 1, cerebro)

Dos proyectos en uno: **TRABAJO** (el sistema de la tienda en vivo) y **VENDER** (el producto Norexos). Todos trabajan a la vez, cada uno en lo suyo (dueños de archivos: `REPARTO_GENERAL_1NOV.md`). **Regla de autorización:** nadie mezcla en `nexora-cloud` ni despliega; lo que quede listo se anota y **espera la autorización de Norexos 1**, que mezcla y despliega solo con 3 CI verdes en el SHA exacto y 0 cajas abiertas (lectura de Norexos 2 de menos de 2 horas). Consulta antes el mapa del sistema: `docs/sistema/mapa/INSTRUCTIVO_SESIONES.md`. Nunca credenciales en archivos ni chats. Reglas de dinero: margen = (precio − costo)/precio sin ITBIS; no se bloquean ventas por margen (decisión de la dueña, 1-nov); no cambiar precios por ofertas.

## TRABAJO (tienda)
**1. Sesión de diagnóstico del CI (nube, Haiku).** Meta: `claude-pc/fix-ci-mes` con los 3 CI verdes. Falla `tests/dinero-auditoria.test.ts:902 y :942` (diferencia de 118): segunda causa = devoluciones restadas por fecha de devolución en `/dashboard/year` y por fecha de venta en el desglose. Arregla con un solo criterio (o ajusta el test si cambiar dinero real no se justifica), prueba con la fecha simulada del día 1 y de mitad de mes. Entrega: SHA y resultado de los 3 CI. **Espera mi autorización para mezclar.**
**2. Claude PC (laptop).** Orden 109: revisar y procesar `gv-incentivos`, `fix-dinero`, `fix-seg-menor`, `anim-reportes` (mezclando `fix-ci-mes` cuando exista, pre-empuje, empujar a la MISMA rama, nota en `docs/auditoria/PROCESO_RAMAS_1NOV.md`). Luego órdenes 106 (cierre propio de GV: construir según `docs/diseno/GV_CIERRE.md`), 107 (rol lectura) y 108 (prueba de acceso, desde una sesión de la nube). Sin parar: cola permanente.
**3. Norexos 2 (Mercancía y cajas).** Tener lista una lectura fresca de cajas abiertas (cuántas, hora). Cuando Norexos 1 la pida, entregarla en una línea. Nada de cambios de mercancía sin orden escrita de la dueña.
**4. Norexos 4 (Revisor de seguridad, solo lectura).** Auditar con `seguridad-20` las ramas `fix-seg-menor`, `fix-dinero` y `gv-incentivos`; informe corto en `docs/auditoria/SEGURIDAD_RAMAS_1NOV.md` con archivo:línea y severidad. No toca código.
**5. Norexos 1.** Auditar diffs, mezclar en orden (arreglo CI → incentivos GV → dinero → seguridad → diseño → `pq-*`), desplegar API y luego web, verificar en vivo, actualizar el mapa.

## DISEÑO Y ANIMACIÓN (tienda y producto)
**6. ChatGPT nube y PC** (`ORDEN_CHATGPT_CONSTRUCTOR_1NOV.md`): pieza 1 (verificar pendientes: hecha en parte), CI de `lumina-adentro-b`, `qa-medios-1nov` (en curso), `f1-01-bundle`; pieza 2: auditar los últimos 7 días de Norexos 1 (solo lectura, informe en `docs/auditoria/AUDITORIA_CHATGPT_A_N1_<fecha>.md`); piezas 3–5 (diseño fuerte, activos de marca, animación futurista y dura, excepto la caja durante el cobro; apagable con reducción de movimiento). Una pieza a la vez. Dueño de `App.tsx` y `styles.css`.
**7. IA local (DeepSeek, Qwen) y Gemini.** Local: `COLA_LOTE_LOCAL.md` (bloques pendientes) y borradores de documentos, sin tocar `App.tsx` ni `styles.css`. Gemini: `ORDEN_GEMINI_PRUEBA_VIVO.md` solo tras el próximo despliegue, en la empresa de pruebas, a ritmo humano.

## VENDER (producto)
**8. Norexos 1 (prepara, espera a la dueña):** publicar la landing (`docs/venta/LANDING_TEXTOS.md`) en cuanto la dueña elija dominio; DNS, certificado y redirección 301; correo de soporte. Sin esas decisiones no se publica.
**9. Dueña (decisiones):** precios (A: tres planes, B: plan único, C: piloto gratis); dominio (`norexos.ai`, `norexos.com`); correo/canal de soporte; abogado para contrato, términos de cobro y marca; elegir 1–2 clientes piloto; certificado de firma del instalador.
**10. ChatGPT (parte de producto):** imágenes y activos de marca (N prismática, favicon e icono PWA, imagen social 1200×630, estados vacíos).

## Pendientes solo de la dueña
Pegar instrucciones nuevas en la rutina horaria de Claude PC; cambiar la clave de `claude-acceso`; `/feedback` sobre la herramienta de sesiones; decisión H-19 (pagos a proveedores con caja registrada); lista de IP de la base de datos; dar a ChatGPT acceso a ejecutar comandos solo en su entorno, sin credenciales.

## Frases para pegar (una por sesión)
- **Claude PC:** «Lee `docs/coordinacion/PLAN_DE_HOY_1NOV.md` (área 2) y la orden 109 de `RESPUESTA_CLAUDE_PC_27OCT.md` y ejecútalas.»
- **ChatGPT nube y PC:** «Lee `docs/coordinacion/PLAN_DE_HOY_1NOV.md` (áreas 6 y 10) y `ORDEN_CHATGPT_CONSTRUCTOR_1NOV.md` y sigue el orden. No mezcles ni despliegues; espera la autorización de Norexos 1.»
- **IA local y Gemini:** «Lee `docs/coordinacion/PLAN_DE_HOY_1NOV.md` (área 7) y tu orden, y empieza.»
