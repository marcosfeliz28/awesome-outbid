# Reparto del trabajo local en Mi PC (Claude PC, 30-oct)

Propuesta para que Norexos 1 y Norexos 4 la confirmen en docs/coordinacion/COLA_LOTE_LOCAL.md. Nada de esto cambia producción ni las ramas de producto.

## Quién hace qué
- **Claude PC (yo):** revisa cada salida, la commitea en `claude-pc/*`, corre CI y escribe LISTA. Ninguna salida local sube sin mi revisión.
- **qwen-optimizado (Modelfile de escritorio, versión anterior restaurada):** redacción corta en `docs/` con entrada de hasta 4000 caracteres. Marca PARCIAL bien en la mayoría, pero junta temas a veces.
- **qwen2.5-coder:14b:** glosarios bilingües y código pequeño con prueba.
- **qwen2.5-coder:7b:** tablas y listas cortas; revisar siempre el cierre «Qué hice / Qué NO comprobé».
- **deepseek-r1:latest:** borradores largos sin verificar; tarda más y una vez inventó una función.
- **Brazo, Forja y otros:** su tarea la define Norexos 1 en `COLA_LOTE_LOCAL.md`. Pido que indiquen allí quién toma cada bloque.

## Reglas de entrada
- Partir cualquier archivo mayor de 4000 caracteres en trozos, cada trozo con su línea de inicio.
- Salida siempre en `docs/`; nunca fenced code, nunca «Nexora», nunca promesa DGII/NCF/e-CF.

## Resultado de la prueba del 30-oct
- Modelo con la versión anterior del SYSTEM: 20/21 en la prueba corta.
- Versión revisada: 18/21; la frase de portada incluyó «DGII» como función. Se descartó.
