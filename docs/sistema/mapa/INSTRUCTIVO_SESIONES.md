# Instructivo del mapa (graphify) para TODAS las sesiones — 1-nov-2026

Mapa del sistema: `docs/sistema/mapa/` (comprimido). Úsalo ANTES de leer archivos a ciegas. Es inferido en parte: cita siempre archivo:línea de la fuente y no decidas dinero solo con el mapa.

## Si puedes ejecutar comandos (Claude nube, Claude PC, ChatGPT con comandos, IA local con terminal)
```bash
pip install graphifyy                                            # una vez (paquete oficial Graphify-Labs, Apache-2.0)
mkdir -p graphify-out && gunzip -c docs/sistema/mapa/graph.json.gz > graphify-out/graph.json
graphify query "tu pregunta" --budget 1500                       # contexto relacionado
graphify explain "NombreDeUnaFuncion"                            # qué es y con qué se conecta
graphify path "A" "B"                                            # camino más corto entre dos cosas
```
Prueba de una línea: `graphify query "¿dónde se calcula el margen?" --budget 800` debe nombrar `reportes/margen.ts`. Si no corre, anótalo en tu archivo de resultados, con el error exacto.
Windows (laptop): igual con `py -m pip install graphifyy`; descomprimir con 7-Zip o `python -c "import gzip,shutil;shutil.copyfileobj(gzip.open('docs/sistema/mapa/graph.json.gz'),open('graphify-out/graph.json','wb'))"`.

## Si NO puedes ejecutar comandos (ChatGPT sin terminal, Gemini)
Lee `docs/sistema/mapa/GRAPH_REPORT.md` (texto): piezas más conectadas, conexiones sorprendentes y preguntas sugeridas. Busca ahí el nombre del archivo o concepto antes de pedirle a otra sesión que lo busque.

## Reglas
- No sobrescribas `graph.json.gz` en el repositorio: solo Norexos 1 lo actualiza tras cada despliegue.
- `graphify-out/` es local y está en `.gitignore`; no se sube.
- Nunca pegues credenciales en consultas ni en notas.
