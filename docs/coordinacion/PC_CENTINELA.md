# PC «Centinela» (DESKTOP-D4STM90): levantamiento y uso (17-nov-2026)

Encendida 24/7, sin costo. Levantamiento hecho por la sesión de Claude «Holla» en esa misma PC, solo lectura (`LEVANTAMIENTO_PC.md` en la PC).

## De qué está hecha

| Parte | Dato |
|---|---|
| Sistema | Windows 11 Pro 64-bit 22H2 |
| Procesador | Intel Celeron N5095, 2.0 GHz, 4 núcleos / 4 hilos (mini PC de bajo consumo) |
| RAM | 15.8 GB |
| Disco | SSD SATA 477 GB (C: 150 GB, D: 150 GB, E: 176 GB, casi vacíos) + USB externo 500 GB (F:) |
| Gráfica | Intel UHD integrada (sin memoria propia) |
| Red | Solo Wi-Fi (57.8 Mbps de enlace), sin cable |
| Programas | Sin Node, Python, Git, Docker ni PostgreSQL |
| Energía | Se suspende a los 15 min e hiberna a las 3 h |

## Para qué sirve (y para qué no)

**Sí:** respaldos locales (copia extra en el disco E: y el USB F:), vigilancia de la tienda cada pocos minutos con aviso por Telegram, tareas livianas programadas (bajar fotos, revisar ramas, reportes), y servir de segunda copia de los archivos de Drive.

**No:** IA local (sin tarjeta gráfica; el procesador es muy débil) ni correr las pruebas completas de la app (tardarían horas). Eso sigue en GitHub y en la nube.

## Para dejarla lista 24/7 (lo hace Marcos o la sesión «Holla» con su permiso)

1. **Que no se duerma:** Configuración → Sistema → Energía → «Suspender» y «Apagar pantalla» en **Nunca** estando enchufada; desactivar la hibernación.
2. **Que vuelva sola tras un apagón:** en la BIOS, «Restore on AC power loss» → **On**.
3. **Red:** si se puede, conectarla por **cable**; el Wi-Fi se cae más.
4. **Instalar gratis:** Git y Node.js LTS (para subir trabajo a GitHub y correr los programas de Norexos).
5. **Actualizaciones de Windows:** fijar «horas activas» o reinicio de madrugada para que no se reinicie de día.

Siguiente paso después de 1-4: programar en ella la vigilancia de la tienda y la copia diaria de los respaldos a E: y F:.
