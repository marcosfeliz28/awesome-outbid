# Plan maestro Norexos — de hoy hasta el lanzamiento (v1, 29-oct-2026)
Dueña: Marcos/Grupo MacGen. Dirige: **Norexos 5 · Director de proyecto** (control, tablero, cronograma). Decide y despliega: **Norexos 1**. Este archivo es la fuente única: si algo cambia, se cambia aquí.

## Fecha estimada de fin
**Lanzamiento controlado: 2 de diciembre de 2026.** Mejor caso 25-nov; peor caso razonable 23-dic. **Supuestos:** la dueña responde las decisiones D1–D6 a más tardar el 31-oct; ChatGPT vuelve el 2-nov; la aprobación del procesador de pagos, el certificado de firma del instalador y la búsqueda de marca no se retrasan más de 2 semanas. **Cada decisión que se retrasa mueve el fin la misma cantidad de días.** e-CF/DGII queda **fuera de la versión 1** (en pausa por orden de la dueña).

## Etapas (con fechas)
| Etapa | Fechas | Qué entrega | Quién | Verificación |
|---|---|---|---|---|
| **E0 Orden** | 29–31 oct | Decisiones D1–D6; dominios norexos.ai/.com registrados; abogado contratado; GV «cambiar fecha» publicado | Dueña, Norexos 1, Taller | Decisiones escritas en TABLERO |
| **E1 Marca en código** | 30 oct–5 nov | Nombre Norexos en web/API/instalador (rama `marca/cambio-nombre`, variables dobles, sin tocar servicio de Windows ni dominios Render) | Norexos PC (Claude PC) + Revisor audita | 3 CI en verde; prueba de marca |
| **E2 App animada y diseño** | 2–12 nov | Componentes `Nx*` conectados; F2-03 (POS) y F3-01 (transiciones) | ChatGPT (desde 2-nov) o Norexos PC; Taller y Forja piezas | 3 CI; capturas 390/1440; caja ciega intacta |
| **E3 Instalador vendible** | 3–14 nov | Firma de código, prueba en PC limpia, actualización, respaldo local, licencia, guía final | Taller (análisis) → Norexos PC (construye) → Revisor | Instalación real en una PC limpia, acta escrita |
| **E4 Español/Inglés** | 5–18 nov | Fases I-0..I-2 del plan internacional (selector de idioma, textos de pantallas clave) | Taller + Forja + Brazo; revisa Norexos 1 | Pruebas; revisión humana de textos de dinero |
| **E5 Cobro, planes y legal** | 3–17 nov | Planes y precios, procesador (Azul), términos y privacidad con abogado, landing norexos.ai, dominio nuevo con 301 | Dueña (decide), Norexos 1, abogado | Cobro de prueba real; documentos firmados |
| **E6 Soporte** | 10–20 nov | Tickets «Pedir un cambio», límites de IA por plan, FAQ | Taller construye; Norexos 1 revisa | Pruebas; piloto de tickets con GV |
| **E7 Piloto cerrado** | 18–25 nov | 1–2 clientes reales con el instalador y la web | Dueña elige clientes; Norexos 5 vigila | Lista de fallos; cero pérdida de datos |
| **E8 Lanzamiento controlado** | 26-nov–2-dic | Venta abierta limitada; plan de soporte | Dueña y Norexos 1 | Checklist de lanzamiento firmada |

**Ruta crítica:** dominios + abogado → marca publicada; aprobación del procesador de pagos; certificado de firma del instalador; vuelta de ChatGPT (2-nov).

## Decisiones que necesita la dueña (D1–D6)
D1 Cupo de GV: bloquear (A) o avisar (B; recomendado). D2 Planes y precios (3 planes; propuesta de Norexos 1). D3 Procesador de pagos: Azul (recomendado). D4 Abogado: ¿tienes uno? D5 Orden: tickets antes o después del cambio de nombre. D6 Clientes piloto (1–2).

## Equipo y reglas de delegación
| Rol | Quién | Para qué |
|---|---|---|
| Decide/despliega | Norexos 1 (Software) | Revisa, mezcla y publica con 3 CI en verde; tienda solo con cajas cerradas y OK de la dueña |
| Control del proyecto | **Norexos 5 (Director)** | Tablero, cronograma, detectar paros, delegar y crear agentes especializados |
| Constructores | Norexos 3 (Taller, Haiku), Norexos PC (Claude PC), ChatGPT (desde 2-nov) | Código con pruebas, una rama por tarea |
| Manos locales sin costo | Forja (`qwen2.5-coder:14b`), Brazo (`deepseek-r1`), vía Norexos PC | Piezas puras, documentos, borradores |
| Inventario | Norexos 2 (Mercancía) | Todo lo de mercancía y cajas |
| Seguridad | Norexos 4 (Revisor, solo lectura) | Audita ramas y plugins antes de mezclar |

**Reglas fijas:** margen = (precio − costo)/precio sin restar ITBIS, mínimo 15 %; precios no se cambian por ofertas; caja ciega; nadie despliega salvo Norexos 1; nunca credenciales en archivos; usar «Norexos» en textos nuevos; 3 CI en verde **del SHA exacto** antes de mezclar.

## Cuando un área se detiene (protocolo del Director)
1. **Detectar:** sin commits, sin respuesta o sin avance en el tablero durante 6 h hábiles (12 h si es de noche).
2. **Diagnosticar** la causa: laptop apagada/inalcanzable · cuota o contexto lleno · esperando decisión de la dueña · CI en rojo · bloqueo externo (banco, abogado, certificado).
3. **Actuar:** reasignar a otra mano · abrir una sesión nueva más barata · crear un **agente especializado** solo para esa parte (registrarlo en el tablero) · o pedir a la dueña una acción concreta de una línea.
4. **Informar:** a la dueña solo cuando haga falta su acción o cambie la fecha de fin; al resto, por archivos.

## Herramientas (skills) a considerar — a auditar por el Revisor antes de instalar
`mattpocock/skills@wayfinder` (739 mil instalaciones; coincide con la lista del reel), `alirezarezvani/claude-skills@senior-pm` (803), `maratraevskiy/skills@kanban_manager` (44, poco probado). Nada se instala sin informe del Revisor y orden de la dueña.

## Ahorro de tokens
Revisión cada 4 h, solo con `git fetch` y lectura de archivos; escribir solo si algo cambió; trabajo pesado en Haiku/Taller y manos locales; Norexos 1 solo decide, revisa y despliega.
