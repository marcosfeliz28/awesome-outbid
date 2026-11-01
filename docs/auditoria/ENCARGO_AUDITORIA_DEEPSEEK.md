# Encargo de auditoría completa para DeepSeek

Fecha: 1-nov-2026. Pide: una auditoría completa de la aplicación en dos pasadas, con 50 propuestas de mejora.

## Qué es la aplicación

Punto de venta e inventario para tiendas (suplementos, maquillaje y fajas) en República Dominicana. Incluye caja, facturas (NCF/ITBIS), reportes DGII 606/607/608, inventario, mercancía, clientes, incentivos, un módulo de cursos (GV) y un asistente. La dueña la usa en su negocio y también se prepara para venderla.

## Alcance (por módulo)

Revisa en este orden. Si no caben en un solo chat, divídelo por módulo y entrega cada uno por separado.

1. **API** (`apps/api/src/`): autenticación, permisos, caja, ventas, facturas, inventario, reportes, clientes, incentivos, GV, copias de respaldo, límites de tasa, validación de entrada.
2. **Web** (`apps/web/src/`): pantallas de caja, tablero, inventario, mercancía, clientes, reportes, configuración, login.
3. **Paquetes compartidos** (`packages/shared`, `packages/ui`): reglas de negocio compartidas y componentes.
4. **Pruebas** (`tests/`): cobertura real y pruebas que no prueban nada.
5. **Despliegue y configuración** (`deploy/`, `render.yaml`, variables de entorno): sin secretos en el repo, cabeceras de seguridad, respaldos.

## Reglas para la auditoría

- Solo lectura. No propongas cambios que toquen la lógica de caja, cobro, dinero o migraciones sin marcarlos como **requieren revisión humana**.
- Usa la lista de 20 controles de seguridad de `.claude/skills/seguridad-20/SKILL.md` como base.
- No inventes hallazgos. Si algo no se puede verificar leyendo el código, di **no comprobado**.
- Cada hallazgo debe citar archivo y línea.

## Dos pasadas completas

**Pasada 1: revisión general.** Recorre los 5 módulos y entrega hallazgos ordenados por gravedad (crítico, alto, medio, bajo).

**Pasada 2: revisión independiente.** Vuelve a leer cada módulo sin mirar tu primera pasada. Marca qué hallazgos de la primera se confirman, cuáles no y cuáles nuevos aparecen.

## Formato de entrega

Por cada una de las 50 propuestas:

| # | Módulo | Archivo:línea | Hallazgo | Gravedad | Propuesta concreta | ¿Requiere revisión humana? (sí/no) | Estado en pasada 2 (confirmado / no confirmado / nuevo) |
|---|---|---|---|---|---|---|---|

Al final, un resumen de máximo 15 líneas: qué es lo más urgente, qué no se pudo comprobar y qué no se revisó.

## Advertencia sobre datos

No pegues en el chat datos reales de clientes (nombres, cédulas, RNC, teléfonos) ni contraseñas, tokens o variables de entorno. Si necesitas un ejemplo, usa datos ficticios.
