# Estado de Norexos (ex Nexora POS) · 29-oct-2026

Para la dueña. Resultado primero. Análisis de solo lectura: no se tocó código, dinero, CI ni producto.
Lo que no se pudo confirmar en el repositorio está marcado **[FALTA INFORMACIÓN]**.

## 1. Resumen en 5 líneas
- **Sí funciona hoy:** la tienda de GV Makeup Studio y el Grupo Macgen, en la nube, con cajas, inventario, GV y reportes.
- **No se puede vender todavía:** faltan registro propio, prueba gratis, cobro, licencia y un instalador probado en una PC limpia.
- **El instalador de Windows está construido pero no probado en una PC limpia.** Es el cuello de botella más grande para vender a otros negocios.
- **Riesgo de continuidad:** Nexora 1 (la única sesión que despliega) vence el jueves. Sin relevo documentado, nada sube a producción.
- **Decisiones que solo tú puedes tomar:** nombre y dominios, abogado, procesador de pago y si el instalador se vende con firma de código.

## 2. Qué existe hoy, por área
| Área | Estado | Evidencia |
|---|---|---|
| Tienda en la nube (POS, caja, inventario, clientes) | listo, en uso | `apps/api/src`, rama `nexora-cloud` |
| Módulo GV (cursos, inscripciones, pagos) | listo; publicado 28-oct | `apps/api/src/gv.ts`, `tests/gv-modulo-api.test.ts` |
| Separación entre empresas (una base, varias empresas) | listo (aprobado 20-oct, 155 rutas) | `PRODUCT_TENANCY_REQUIRED` (`apps/api/src/common.ts`) |
| Reportes 606/607/608 e IT-1 | parcial; 606 pendiente de prueba del contador | `docs/coordinacion/PLAN_MAESTRO_POR_FASES_27OCT.md` (Fase 5) |
| Facturación electrónica (e-CF) | **pausada** por orden tuya | `docs/operacion/MEMORIA_NEXORA1.md` |
| Asistente de IA | parcial; límites por plan sin definir | `docs/operacion/MEMORIA_NEXORA1.md` |
| Diseño de la app | en curso; plan animado escrito | `docs/diseno/PLAN_APP_ANIMADA_29OCT.md` (pruebas en `claude/taller-anim`) |
| Pedidos de cambio (tickets) | solo spec, sin construir | `docs/diseno/SPEC_TICKETS_SOLICITUDES.md` |
| Página pública y textos de venta | borrador | `docs/venta/LANDING_TEXTOS.md` |
| Marca Norexos | decidida; dominios y abogado pendientes | `docs/marca/PLAN_CAMBIO_DE_NOMBRE.md` |
| Instalador Windows | parcial: compila; sin prueba física | `instalador/README.md`, `instalador/build.ps1` |
| Despliegue en Render | listo, solo lo hace Nexora 1 | `deploy/render/`, `docs/operacion/MEMORIA_NEXORA1.md` |
| Migraciones de base de datos | 59 carpetas; reglas en `docs/MIGRACIONES_SEGURAS.md` | `apps/api/prisma/migrations` |
| Registro público, 14 días gratis, planes | **falta** | no hay flujo de alta de empresas en la app |
| Cobro real (procesador) | **falta**; hoy solo de prueba | sin decisión de procesador (Azul recomendado) |
| Licencia o activación del producto | **falta** | sin código de licencia en `apps/api/src` |

## 3. El instalador de Windows
**Qué hace, paso a paso** (`instalador/build.ps1`, `instalador/scripts/`):
1. Compila: verifica Node 24 y pnpm, instala dependencias bloqueadas, compila la API y la app web.
2. Descarga y comprueba con SHA-256: Node 24.21.0, PostgreSQL 18.6, WinSW y el runtime de Visual C++ (firma de Microsoft verificada).
3. Empaqueta con NSIS en un solo `Nexora-POS-Setup-<versión>.exe`.
4. Al instalar en la PC: preflight (`Preflight-FitStore.ps1`), instala PostgreSQL local, servicios de API y web, certificados HTTPS, reglas de firewall, base y respaldo.
5. Actualiza sin perder datos: copia de seguridad, staging con manifiesto, rollback si falla.
6. Desinstala conservando el respaldo (`Uninstall-FitStore.ps1`).

**Qué necesita un cliente en una PC limpia:** Windows 11 de 64 bits, permisos de administrador, y [FALTA INFORMACIÓN] CPU, RAM y espacio mínimos (no están escritos).

**Lo que no está probado o falta:**
| Punto | Estado | Qué hace falta |
|---|---|---|
| Firma de código del `.exe` (SmartScreen) | **falta** | certificado de firma de código; sin él Windows avisa «editor desconocido» |
| Prueba física en una PC limpia | **falta** | que ChatGPT PC (o alguien) la corra con datos inventados (Fase 7) |
| Pruebas de PowerShell (~50 archivos en `instalador/tests`) | escritas; solo corren en Windows | ejecutarlas en una PC Windows |
| Actualización automática | **no existe**; se actualiza reinstalando | decidir si basta con reinstalar |
| Copia de seguridad local automática | script existe; programación [FALTA INFORMACIÓN] | confirmar cómo se programa en el cliente |
| Puertos y red local | firewall y HTTPS locales configurados; orden de puertos [FALTA INFORMACIÓN] | prueba en red real |
| Licencia o activación | **no existe** | decidir modelo (ver §5) |
| Versión de Node y PostgreSQL | fijadas: Node 24.21.0 y PostgreSQL 18.6, incluidas en el instalador | actualizarlas solo con revisión |
| Sin internet | el servidor local funciona; IA y correo no | confirmar qué funciones dependen de internet |
| Nota: la base de la nube | el instalador crea una base **local**; no sirve para cajas que compartan la nube | cada caja compartida usa la web publicada |

## 4. Qué falta para vender (prioridad)
| Prioridad | Qué | Tipo |
|---|---|---|
| **Alta** | Prueba física del instalador en una PC limpia | técnico |
| **Alta** | Firma de código del instalador | técnico + compra |
| **Alta** | Relevo de despliegue (quién sube a Render después del jueves) | operación |
| **Alta** | Abogado: términos, privacidad (Ley 172-13) y contrato de licencia | legal |
| **Alta** | Dominios norexos.ai y norexos.com a nombre tuyo; búsqueda de marca | legal/comercial |
| **Media** | Registro propio, prueba de 14 días y solo lectura al vencer | técnico |
| **Media** | Procesador de pago (Azul recomendado) | comercial |
| **Media** | Licencia o activación del producto | técnico |
| **Media** | Página pública con precios y planes | comercial |
| **Media** | Manual por rol (cajera, administradora) y guía de inicio | soporte |
| **Baja** | Actualización automática; WhatsApp; resumen diario por correo | técnico |

## 5. Plan (pasos, quién, cómo se verifica)
| Paso | Quién | Cómo se verifica | Esfuerzo |
|---|---|---|---|
| 1. Relevo de despliegue documentado y probado bajo supervisión | Nexora 1 + sesión sucesora (la creas tú) | un despliegue de prueba con 3 CI verdes | medio |
| 2. Prueba física del instalador | ChatGPT PC o persona en la laptop | instalación limpia, caja y entrada funcionando, documento de prueba | medio |
| 3. Firma de código del instalador | tú (certificado) + Claude PC | SmartScreen sin aviso en PC limpia | poco (si compras el certificado) |
| 4. Abogado y dominios | tú + abogado | contratos y dominios registrados | medio |
| 5. Registro, prueba y planes | ChatGPT PC (construye) + ChatGPT nube (audita) | una empresa nueva se registra, prueba y exporta | mucho |
| 6. Cobro real y licencia | tú (cuenta del procesador) + construcción | un pago de prueba y una licencia activada | mucho |
| 7. Página pública y textos | ChatGPT nube + tú (revisión) | visitante ve precios y se registra | medio |
| 8. Diseño de la app (animación, portada) | Taller + Claude PC | pruebas F2-01 y capturas en claro y oscuro | en curso |

Reglas que no cambian: margen mínimo 15 %, sin cambiar precios por una oferta, nada de la tienda se toca sin tu conteo, e-CF en pausa.

## 6. Decisiones que necesitan a la dueña
1. **¿Vendemos el instalador con firma de código ahora?** Recomendación: **sí**, es la diferencia entre un aviso de «editor desconocido» y una instalación seria.
2. **¿Quién despliega después del jueves?** Recomendación: **una sesión sucesora con llaves**, creada por ti en un entorno propio, y el procedimiento escrito en `docs/operacion/`.
3. **¿Se contrata abogado y se registran norexos.ai y norexos.com a tu nombre?** Recomendación: **sí, esta semana**; sin eso no hay marca que vender.
4. **¿Modelo de venta: suscripción mensual o licencia por PC?** Recomendación: **suscripción mensual**; la nube y las actualizaciones se cobran mejor así.
5. **¿El producto vendido usa la nube compartida o el servidor local?** Recomendación: **nube**, porque el instalador local no comparte base entre cajas.
6. **¿Mantenemos la facturación electrónica (e-CF) en pausa para la primera venta?** Recomendación: **sí**; la lleva tu contador después.
7. **¿Aprueba el borrador de la página pública y sus precios?** Recomendación: **revisarlo antes de publicar**; hoy solo hay textos.
8. **¿Quién prueba el instalador en una PC limpia?** Recomendación: **ChatGPT PC con datos inventados**, según la Fase 7.
