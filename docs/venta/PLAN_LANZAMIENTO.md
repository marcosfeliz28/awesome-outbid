# Plan de lanzamiento de Norexos (borrador, 30-oct-2026)

Borrador de Claude PC sobre `docs/proyecto/PLAN_MAESTRO_NOREXOS.md` (E0–E8). No decide nada: cada ítem dice quién decide. Lo que no está confirmado en el repo va marcado «por confirmar».

## 1. Dominio norexos.ai
| Ítem | Estado | Decide / hace |
|---|---|---|
| Registrar norexos.ai y norexos.com (E0) | Por confirmar si ya están registrados | Dueña decide; Norexos 1 ejecuta |
| Landing ya hecha (`docs/venta/LANDING_TEXTOS.md`) | Hecha; falta publicarla en el dominio | Norexos 1 despliega |
| DNS (registros A/CNAME hacia el alojamiento de la landing) | Falta | Norexos 1; la dueña da acceso al registrador (nunca en archivos) |
| Verificación del dominio (correo, certificado HTTPS) | Falta | Norexos 1 |
| Redirección 301 desde el dominio actual de la tienda | Falta (E5) | Norexos 1 |
| Botón de prueba gratis y correo de soporte del pie (preguntas 1 y 2 de `PREGUNTAS_DUENA_VENTA.md`) | Sin respuesta | **Dueña** |

## 2. Soporte
| Ítem | Estado | Decide / hace |
|---|---|---|
| Correo o canal oficial de soporte | Sin decidir | **Dueña** |
| Tickets «Pedir un cambio» (E6) | Por construir | Taller construye; Norexos 1 revisa |
| FAQ de caja, GV y administración | Borradores y verificados en `docs/venta/` | Norexos 1 aprueba publicación |
| Horario y tiempo de respuesta prometido | Sin decidir | **Dueña** |
| Piloto de tickets con GV | Falta | Dueña elige; Norexos 5 vigila |

## 3. Precios y planes (opciones, sin decidir)
| Opción | Idea | Decide |
|---|---|---|
| A. Tres planes por tamaño (propuesta de Norexos 1, D2) | Básico / Medio / Completo con límites de cajas, usuarios e IA | **Dueña** |
| B. Un plan único con IA aparte | Menos opciones, más fácil de explicar | **Dueña** |
| C. Piloto gratis y luego plan | Los 1–2 clientes del piloto (D6) prueban sin costo | **Dueña** |
Cualquiera exige: límite de uso de IA por plan (E6), regla de margen mínimo 15 % sin restar ITBIS y que los precios no cambien por ofertas (reglas fijas del plan maestro). Procesador de pagos: Azul recomendado (D3); necesita aprobación del procesador y un cobro de prueba real (E5). **Dueña decide.**

## 4. Requisitos legales básicos (todo lo confirma un abogado)
| Ítem | Estado | Decide / hace |
|---|---|---|
| Abogado contratado (D4) | Por confirmar | **Dueña** |
| Términos de servicio | Falta | Abogado redacta; dueña firma |
| Política de privacidad y tratamiento de datos de clientes y empleados | Falta | Abogado; Norexos 1 aporta qué datos guarda el sistema (`docs/sistema/DATOS_Y_MODELOS.md`) |
| Condiciones de cobro, reembolsos y cancelación | Falta | Dueña con abogado |
| Registro de la marca Norexos | Por confirmar | Dueña con abogado |
| Obligaciones fiscales de vender el servicio (facturación propia) | Por confirmar | Contador / abogado |

## 5. Qué falta del producto (según etapas E1–E8)
| Pieza | Etapa | Estado según el plan |
|---|---|---|
| Nombre Norexos en web, API e instalador | E1 | En curso |
| App animada y diseño (POS F2-03, transiciones F3-01) | E2 | Desde 2-nov |
| Instalador vendible: firma de código, prueba en PC limpia, actualización, respaldo, licencia | E3 | Falta el certificado de firma (ruta crítica) |
| Español/Inglés (selector y pantallas clave) | E4 | Por construir |
| Cobro y planes dentro del producto | E5 | Por construir |
| Límites de IA por plan | E6 | Por construir |
| Piloto cerrado de 1–2 clientes, cero pérdida de datos | E7 | 18–25 nov |
| Checklist de lanzamiento firmada | E8 | 26-nov–2-dic |

## 6. Ruta crítica (del plan maestro)
Dominios + abogado → marca publicada; aprobación del procesador de pagos; certificado de firma del instalador; vuelta de ChatGPT (2-nov). Nadie despliega salvo Norexos 1.
