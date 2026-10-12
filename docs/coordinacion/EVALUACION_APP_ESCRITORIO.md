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

## Estado técnico verificado (evaluación, no prototipo)

La recomendación de Electron que sigue es una hipótesis de evaluación, no una solución validada: `apps/web` no tiene una integración o scripts de Electron. Existe un scaffold de Tauri, pero eso tampoco demuestra que compile, se instale o funcione con la API real. Antes de elegir, comparar el scaffold existente con Electron y levantar un prototipo.

Hay dos incompatibilidades que el prototipo debe resolver:

1. El cliente web usa rutas relativas `/api/...`; el proxy de Vite solo existe en desarrollo/preview. Una ventana local empaquetada necesita una URL configurable y segura de la API remota, y pruebas de CORS, cookies y renovación de sesión desde el origen de escritorio. La compatibilidad del login web no está demostrada.
2. El cliente actual guarda datos y colas offline en Dexie/IndexedDB y puede encolar ventas para sincronizarlas. No es una segunda base Postgres, pero sí es almacenamiento y sincronización locales propios. Si el requisito es no tenerlos, el wrapper debe desactivarlos de forma verificable; si se heredan, no se cumple todavía ese requisito.

## Recomendación

No elegir ni cotizar Electron como solución ya validada. Primero hacer un prototipo comparativo pequeño (Tauri, cuyo scaffold ya existe, frente a Electron) y demostrar: conexión al API HTTPS configurado, inicio/renovación/cierre de sesión, permisos, CORS/cookies, y que no se persisten datos ni se encolan ventas offline. Si se autoriza Electron, usar la interfaz empaquetada localmente y la API remota de Nexora por HTTPS; no cargar páginas arbitrarias ni dar acceso de Node a la interfaz. Seguir las recomendaciones oficiales de Electron: aislamiento de contexto, sandbox, permisos mínimos, navegación limitada, CSP y actualizaciones del runtime.

**No equivale a trabajar sin internet.** Login y datos dependen de la API en la nube. La web actual sí tiene almacenamiento IndexedDB/Dexie y sincronización de cola offline. El prototipo debe probar si el wrapper puede operar estrictamente online y evitar esas escrituras; no se debe prometer “sin almacenamiento local” hasta verificarlo. Habilitar ventas offline requeriría una decisión separada sobre conflictos, sesión, seguridad y caja; no asumir que la cola PWA funciona en escritorio.

## Alcance y esfuerzo aproximado

- **Prototipo/evaluación Windows (3–5 días hábiles, estimación):** comparar en Tauri y Electron un flujo mínimo contra API de prueba y decidir una sola tecnología. Criterios de salida: HTTPS y URL configurable, login/renovación/cierre de sesión, permisos, CORS/cookies, y comprobar que no se persistan datos ni se encolen ventas offline. No incluye instalador firmado, despliegue ni operación real; impresión básica queda fuera de este prototipo.
- **Versión lista para piloto (1–2 semanas):** autoactualización segura, firma/certificado del instalador, manejo de fallos de red, pruebas de impresión térmica/lector, instalación y actualización en equipos limpios, permisos y borrado de sesión, pruebas de seguridad y recuperación. La cifra puede crecer si hay que modificar login o la política offline.
- **iPhone/Android:** no se incluyen en estos plazos; serían una evaluación y empaquetado móviles distintos.

Los tiempos son estimaciones de planificación, no compromiso ni cotización. Antes de construir, la dueña debe confirmar si quiere únicamente ventana sin navegador, si el uso requiere internet permanente y cuáles modelos de impresora/lector se probarán.

## Riesgos que deben cerrarse antes de autorizar código

1. **Seguridad:** las credenciales y sesiones deben permanecer protegidas; jamás incluir contraseñas fijas ni exponer APIs privilegiadas a páginas remotas.
2. **Actualizaciones:** el cliente local puede quedarse detrás de la versión web; cada entrega necesita firma, canal de actualización, reversión y política de soporte.
3. **Autenticación compartida:** la web renueva sesión mediante cookie y guarda estado de usuario/expiración en Dexie. Hay que probar qué origen usa la app, si su navegador interno acepta la cookie `credentials: include`, CORS y renovación; proteger tokens y borrar sesión al salir. Nada de usuarios locales separados.
4. **Impresión y periféricos:** probar ticket 80 mm, lector USB/Bluetooth y reimpresión en cada modelo soportado.
5. **Conexión:** declarar claramente qué pasa si cae internet; no prometer ventas offline hasta aprobar y probar su comportamiento real.
6. **Datos:** mantener la base como servicio administrado en la nube; no replicar catálogo, ventas ni clientes en una base local.

## Fuentes

Arquitectura actual verificada para orientar un prototipo: la aplicación web React usa endpoints relativos y Vite proxy en desarrollo; el POS mantiene almacenamiento/colas IndexedDB y puede trabajar offline. El SDK de escritorio no está integrado ni se ha probado una API remota desde un origen local. Hay que demostrar la conexión/autenticación y el modo online sin cola local antes de decidir la arquitectura.

Documentación oficial consultada el 10-oct-2026: [Electron: requisitos y Chromium incluido](https://www.electronjs.org/docs/latest/tutorial/tutorial-prerequisites), [seguridad de Electron](https://www.electronjs.org/docs/latest/tutorial/security), [aislamiento de contexto](https://www.electronjs.org/docs/latest/tutorial/context-isolation) y [WebView2 de Tauri en Windows](https://v2.tauri.app/start/prerequisites/).
