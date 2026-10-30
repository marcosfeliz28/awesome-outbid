# Conocimiento base de Norexos (para el modelo local)

Lo que el modelo debe saber antes de cada tarea. Si algo no aparece aquí, buscarlo en el repo y decir «NO ENCONTRADO».

## Quién es quién
- Marcos: la dueña. Solo habla con Norexos 1. Aprueba lo que cambia producción o dinero.
- Norexos 1: decide mezclas y despliegues. Escribe las órdenes en `docs/coordinacion/RESPUESTA_CLAUDE_PC_27OCT.md` (rama nexora-cloud).
- Norexos 4: Revisor de seguridad. Audita antes de instalar o mezclar.
- Norexos PC (Claude PC): revisa, prueba y sube las ramas claude-pc/*. Maneja al modelo local.
- Norexos 2 y Norexos 3: Mercancía y Taller (diseño, plugins y pruebas).

## Ramas y reglas de git
- `producto-nexora`: el producto. Nunca mezclar ahí sin orden de Norexos 1.
- `nexora-cloud`: la tienda y los documentos de coordinación. Nunca mezclar ahí sin orden.
- `claude-pc/*`: ramas de trabajo de Claude PC. Un commit por arreglo, con prueba que falle antes y pase después.
- Nunca `--force`. Nunca commits vacíos. Push una vez por tanda (el CI cancela el anterior).
- Antes de pushear, mezclar la base actual (`git merge origin/producto-nexora`).

## Verificación
- Tres CI deben estar en verde en el SHA exacto: `verify`, `windows-installer`, `render-images`.
- Solo entonces se escribe LISTA: `LISTA: RAMA COMMIT (verify, windows-installer y render-images en verde)`.
- No escribir LISTA de ramas sueltas de Forja: Norexos 1 arma la rama final.
- Un CI rojo no se relanza a ciegas: se diagnostica con la lista de pruebas.

## Dinero y datos (no cambiar sin orden)
- Margen = (precio − costo) / precio, sin restar ITBIS. Mínimo 15 % (regla de la dueña).
- Caja ciega: la cajera no ve el total esperado mientras la caja está abierta.
- RD$, NCF e ITBIS no se traducen.
- No inventar cifras: si no hay fuente, `[FALTA INFORMACIÓN]`.

## Escritura de documentos
- Encabezado «Borrador sin verificar» y fuente: rama y commit.
- Límites numéricos (caracteres, conteos) los mide un script, no el modelo.
- Escribir «Norexos» (no Nexora) en texto nuevo. Mensajes cortos, en español.

## Seguridad
- Nunca claves, contraseñas, datos bancarios ni datos de clientes en archivos o chats.
- No leer `docs/operacion/`, `docs/legal/`, `docs/seguridad/` ni `.env*`.
- No instalar plugins sin el veredicto del Revisor.
