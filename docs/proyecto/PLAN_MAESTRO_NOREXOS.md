# Plan maestro Norexos — v2 (29-oct-2026)
Dueña: Marcos/Grupo MacGen. Dirige: **Norexos 5 · Director de proyecto** (control, tablero, cronograma). Decide y despliega: **Norexos 1**. **La dueña habla solo con Norexos 1**; todos los demás reportan a Norexos 1. Este archivo es la fuente única: si algo cambia, se cambia aquí.

## Fecha estimada de fin
**Lanzamiento controlado: 24 de noviembre de 2026.** Mejor caso 18-nov. **Cambio respecto a v1 (2-dic): decisión de Norexos 1 del 29-oct de quitar cobro y documentos legales del alcance de la v1 y reducir tiempos.** Riesgo abierto: lanzar sin cobro real; la dueña debe confirmarlo por medio de Norexos 1. **Supuestos:** decisiones D1, D2, D5, D6 y D7 a más tardar el 30-oct (E0); ChatGPT vuelve el 2-nov. **Cada decisión que se retrasa mueve el fin la misma cantidad de días.** e-CF/DGII queda **fuera de la versión 1**.

## Alcance quitado en v2 (29-oct)
- Abogado y documentos legales (términos, privacidad): fuera de la v1.
- Cobro con Azul (D3) y abogado de marca (D4): fuera de la v1.
- Precios (D2): pasan al final del plan, antes de E8.

## Etapas (plan v2)
| Etapa | Fechas | Qué entrega | Quién | Verificación |
|---|---|---|---|---|
| **E0 Orden** | 29–30 oct | Decisiones D1, D2, D5, D6, D7; dominio norexos.ai registrado | Dueña, Norexos 1 | Decisiones escritas en TABLERO |
| **E1 Marca en código** | 30 oct–2 nov | Nombre Norexos en web/API/instalador (rama `marca/cambio-nombre`, sin tocar servicio de Windows ni dominios Render). **Reasignada al Taller** (la laptop estuvo apagada) | Taller; Norexos PC solo audita si la laptop vuelve | 3 CI en verde; prueba de marca |
| **E2 App animada y diseño** | 31 oct–7 nov | Componentes `Nx*` conectados; F2-03 (POS) y F3-01 (transiciones) | Taller; ChatGPT puede tomar F2-03/F3-01 desde el 2-nov | 3 CI; capturas 390/1440; caja ciega intacta |
| **E3 Instalador vendible** | 2–10 nov | Licencia/activación, actualización automática, respaldo local; firma de código solo si la dueña compra el certificado (D7) | Taller (código); Norexos PC prueba en Windows; Revisor audita | Instalación real en una PC limpia, acta escrita |
| **E4 Español/Inglés** | 3–12 nov | Fases I-0..I-2 (selector de idioma, textos de pantallas clave) | Taller + Forja + Brazo; revisa Norexos 1 | Pruebas; revisión humana de textos de dinero |
| **E5 Landing y dominio** | 8–12 nov | Landing en norexos.ai; dominio nuevo con 301 | Taller (textos); dueña (dominio) | Página publicada; redirección probada |
| **E6 Soporte** | 8–14 nov | Tickets «Pedir un cambio» (después del cambio de nombre), límites de IA por plan, FAQ | Taller; Norexos 1 revisa | Pruebas; piloto de tickets con GV |
| **E7 Piloto cerrado** | 15–21 nov | 1–2 clientes reales con el instalador y la web | Dueña elige clientes (D6); Norexos 5 vigila | Lista de fallos; cero pérdida de datos |
| **E8 Lanzamiento controlado** | 24 nov | Venta abierta limitada; plan de soporte; precios cerrados (D2) | Dueña y Norexos 1 | Checklist de lanzamiento firmada |

**Ruta crítica v2:** dominio norexos.ai → landing (8–12 nov); cambio de nombre (2 nov) → tickets (8–14 nov); certificado de firma (D7), si se compra → instalador (E3); vuelta de ChatGPT (2-nov).

## Decisiones que necesita la dueña (vía Norexos 1)
D1 Cupo de GV: bloquear (A) o avisar (B; recomendado). D2 Precios (al final del plan). D5 Orden: **resuelto** (tickets después del cambio de nombre). D6 Clientes piloto (1–2). **D7 (nueva): comprar o no el certificado de firma del instalador.** D3 y D4 retiradas del alcance de v1.

## Equipo y reglas de delegación
| Rol | Quién | Para qué |
|---|---|---|
| Decide/despliega | Norexos 1 (Software) | Revisa, mezcla y publica con 3 CI en verde; tienda solo con cajas cerradas y OK de la dueña. Único canal con la dueña |
| Control del proyecto | **Norexos 5 (Director)** | Tablero, cronograma, detectar paros, delegar |
| Constructores | Taller (Norexos 3, Haiku), Norexos PC (si vuelve la laptop), ChatGPT (desde 2-nov) | Código con pruebas, una rama por tarea |
| Manos locales sin costo | Forja (`qwen2.5-coder:14b`), Brazo (`deepseek-r1`), vía Norexos PC | Piezas puras, documentos, borradores |
| Inventario | Norexos 2 (Mercancía) | Todo lo de mercancía y cajas; reporta a Norexos 1 |
| Seguridad | Norexos 4 (Revisor, solo lectura) | Audita ramas y plugins antes de mezclar |

**Reglas fijas:** margen = (precio − costo)/precio sin restar ITBIS, mínimo 15 %; precios no se cambian por ofertas; caja ciega; nadie despliega salvo Norexos 1; nunca credenciales en archivos; usar «Norexos» en textos nuevos; 3 CI en verde **del SHA exacto** antes de mezclar.

## Cuando un área se detiene (protocolo del Director)
1. **Detectar:** sin commits, sin respuesta o sin avance en el tablero durante 6 h hábiles (12 h si es de noche).
2. **Diagnosticar** la causa: laptop apagada/inalcanzable · cuota o contexto lleno · esperando decisión de la dueña · permiso pendiente en una sesión · CI en rojo · bloqueo externo.
3. **Actuar:** reasignar a otra mano · abrir una sesión nueva más barata · crear un **agente especializado** solo para esa parte (registrarlo en el tablero) · o pedir a Norexos 1 una acción concreta.
4. **Informar:** a Norexos 1 por archivo o mensaje; nunca directo a la dueña.

## Herramientas (skills) — pendientes de auditoría, no instaladas
Candidatas: `mattpocock/skills@wayfinder` (propuesta de Norexos 1, commit a496f55), `alirezarezvani/claude-skills@senior-pm`, `maratraevskiy/skills@kanban_manager`. **Nada se instala sin informe del Revisor y orden de Norexos 1.** Norexos 5 no instala skills.

## Ahorro de tokens
Revisión cada 4 h, solo con `git fetch` y lectura de archivos; escribir solo si algo cambió; trabajo pesado en Taller y manos locales; Norexos 1 solo decide, revisa y despliega.
