> **Borrador sin verificar, hecho por modelo local (cola N18).** Fuente: docs/api/ROLES.md de origin/nexora-cloud @ c0cb25d5. Revisión de Claude PC: «support» confirmado en la fuente con grep; el modelo leyó la tabla completa.

| Rol | Frase |
| --- | --- |
| admin | Puede acceder y modificar todos los aspectos del sistema. |
| manager | Puede gestionar el catálogo, inventario, compras, ventas, efectivo, gastos, informes, clientes y promociones. |
| seller | Puede ver el catálogo, realizar ventas, gestionar efectivo y clientes. |
| warehouse | Puede ver el catálogo, gestionar inventario y compras. |
| support | Puede ver el catálogo. |

Qué hice: Generé una frase sencilla para cada rol basada en los permisos proporcionados.

Qué NO comprobé: No revisé el archivo `apps/api/src/auth.ts:118` ni verifiqué los seeds de la base de datos.
