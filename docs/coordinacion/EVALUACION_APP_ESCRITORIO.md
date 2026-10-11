# Evaluación de una aplicación de escritorio para Nexora POS

**Alcance:** evaluación sin código. La meta es abrir Nexora en una ventana instalada en Windows, entrar con el mismo usuario de la nube y usar la misma base/API. No crear otra base local ni un mecanismo de sincronización paralelo.

## Qué quiere decir “no depender del navegador”

Una aplicación de escritorio puede abrir en su propia ventana, sin pestañas ni barra de direcciones. Aun así, tiene que dibujar la interfaz: puede traer su propio motor web o usar el componente web del sistema. Y, si consulta la base en Render, seguirá necesitando internet para iniciar sesión y operar en línea.

| Opción | Ventana de aplicación | Motor web | Ventaja | Costo/riesgo principal |
| --- | --- | --- | --- | --- |
| PWA instalada | Ventana sin pestañas, instalada desde Edge/Chrome | Depende del navegador instalado | Menor esfuerzo; la web se actualiza en el servidor | Sigue dependiendo de ese navegador y su instalación. |
| Tauri | Aplicación de escritorio | En Windows usa WebView2 del sistema | Instalador potencialmente más pequeño | Debe comprobarse/instalarse el runtime WebView2 y probarlo en cada Windows objetivo. |
| Electron | Aplicación de escritorio propia | Incluye Chromium y Node.js | No requiere que la persona abra Chrome/Edge; apariencia y distribución controlables | Instalador y actualizaciones más pesados; el motor Chromium debe mantenerse al día y configurarse con endurecimiento de seguridad. |
| Aplicación nativa completa | Aplicación del sistema | No depende de la interfaz web | Mayor control del sistema operativo | Rehacer la interfaz; más costo para Windows, iPhone y Android y riesgo de duplicar reglas de venta. |

## Recomendación

Para la petición de Windows, evaluar primero **Electron con la interfaz empaquetada localmente y la API remota de Nexora por HTTPS**, usando el mismo flujo de autenticación. Eso abre una aplicación separada y no lanza un navegador externo. Evitar cargar páginas arbitrarias o dar acceso de Node a la interfaz. Seguir las recomendaciones oficiales de Electron: aislamiento de contexto, sandbox, permisos mínimos, navegación limitada, CSP y actualizaciones del runtime.

**No equivale a trabajar sin internet.** Login y datos dependen de la API en la nube. Una cola offline compatible sería otro requisito: hay que definir qué se puede vender, cómo se resuelven conflictos, cómo se conserva la sesión y cómo se protege la caja. No guardar una copia local de la base ni asumir que la cola PWA sirve sin pruebas de escritorio.

## Alcance y esfuerzo aproximado

- **Prototipo Windows (3–5 días hábiles):** ventana Electron, login contra la API real de prueba, navegación, impresión básica y paquete instalable firmado para pruebas. No incluye despliegue ni operación real.
- **Versión lista para piloto (1–2 semanas):** autoactualización segura, firma/certificado del instalador, manejo de fallos de red, pruebas de impresión térmica/lector, instalación y actualización en equipos limpios, permisos y borrado de sesión, pruebas de seguridad y recuperación. La cifra puede crecer si hay que modificar login o la política offline.
- **iPhone/Android:** no se incluyen en estos plazos; serían una evaluación y empaquetado móviles distintos.

Los tiempos son estimaciones de planificación, no compromiso ni cotización. Antes de construir, la dueña debe confirmar si quiere únicamente ventana sin navegador, si el uso requiere internet permanente y cuáles modelos de impresora/lector se probarán.

## Riesgos que deben cerrarse antes de autorizar código

1. **Seguridad:** las credenciales y sesiones deben permanecer protegidas; jamás incluir contraseñas fijas ni exponer APIs privilegiadas a páginas remotas.
2. **Actualizaciones:** el cliente local puede quedarse detrás de la versión web; cada entrega necesita firma, canal de actualización, reversión y política de soporte.
3. **Autenticación compartida:** hay que verificar que la sesión y permisos sean iguales a la web; nada de usuarios locales separados.
4. **Impresión y periféricos:** probar ticket 80 mm, lector USB/Bluetooth y reimpresión en cada modelo soportado.
5. **Conexión:** declarar claramente qué pasa si cae internet; no prometer ventas offline hasta aprobar y probar su comportamiento real.
6. **Datos:** mantener la base como servicio administrado en la nube; no replicar catálogo, ventas ni clientes en una base local.

## Fuentes

Arquitectura actual a validar: la aplicación web React consulta la API de Nexora; el código del POS mantiene trabajo pendiente de sincronización en el navegador. Los requisitos de plataforma deben confirmarse con un prototipo.

Documentación oficial consultada el 10-oct-2026: [Electron: requisitos y Chromium incluido](https://www.electronjs.org/docs/latest/tutorial/tutorial-prerequisites), [seguridad de Electron](https://www.electronjs.org/docs/latest/tutorial/security), [aislamiento de contexto](https://www.electronjs.org/docs/latest/tutorial/context-isolation) y [WebView2 de Tauri en Windows](https://v2.tauri.app/start/prerequisites/).
