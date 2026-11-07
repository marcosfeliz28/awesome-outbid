# Base nutricional para app de conteo de macros

Generada el 30‑sep‑2026. **Versión 2.1 (6‑nov‑2026)**: ver «Cambios de la v2» al final. Todos los valores son **por 100 g de porción comestible**, salvo que se indique otra cosa.

## Qué contiene

| Archivo | Filas | Qué es |
|---|---|---|
| `nutricion.sqlite` | — | Todo lo de abajo (menos los extras de marca) en una sola base SQLite, con búsqueda de texto `buscar` (FTS5, ignora acentos). **Es lo que conviene importar en la app.** |
| `alimentos_app.csv` (y vista `alimentos_app`) | 13.552 | **Tabla lista para la app**: una fila por alimento con los macros finales (valor verificado si es popular, USDA si no), origen y estado de verificación. Filtra con `es_preferido=1` para no ver duplicados |
| `alimentos.csv` | 13.552 | Alimentos genéricos del USDA con nombre en español, sinónimos dominicanos/latinos y 33 nutrientes por 100 g. Nuevas columnas `es_popular` y `es_preferido` |
| `populares_rd_latam_verificados.csv` | 649 | Alimentos comunes en RD/Latam, verificados contra 3 tablas gubernamentales más. Incluye el valor recomendado, el rango entre fuentes y los valores de cada fuente |
| `porciones.csv` | 32.372 | Medidas caseras en gramos (taza, cda, unidad mediana, rebanada…). **Todos** los alimentos tienen al menos una; columna `origen` = `USDA` o `conversión de peso` (100 g y 1 oz añadidas donde el USDA no publica porción) |
| `nutrientes_detalle.csv` | 1.011.841 | Todos los nutrientes publicados (hasta ~250 por alimento: aminoácidos, ácidos grasos, etc.) |
| `unidades_peso.csv` | 5 | g, kg, oz, lb, mg → gramos |
| `fuentes.csv` | 8 | Fuentes, versión, licencia y URL |
| `base_nutricional_consulta.xlsx` | — | Versión Excel para consultar a mano |
| **Extras** | | |
| `productos_marca_usda.csv.gz` | 435.680 | Productos de marca (EE. UU., muchos se venden en RD), con código de barras. Valores de la etiqueta del fabricante |
| `productos_openfoodfacts_latam_es_us.csv.gz` | 345.752 | Open Food Facts: productos de RD, Latinoamérica, España y EE. UU. |
| `productos_openfoodfacts_mundial.csv.gz` | 2.038.179 | Open Food Facts: todos los países |

## Fuentes y nivel de confianza

1. **USDA FoodData Central** (gobierno de EE. UU., dominio público) es la **base principal**:
   - *Foundation Foods* (abr‑2026) y *SR Legacy*: análisis de laboratorio. Máxima confianza.
   - *FNDDS 2021‑2023*: platos y recetas de la encuesta nacional, calculados a partir de ingredientes.
2. **Verificación cruzada** con otras tres tablas oficiales:
   - Reino Unido: **CoFID 2021** (McCance & Widdowson)
   - Australia: **AFCD Release 3** (FSANZ, dic‑2025)
   - Brasil: **TACO 4ª ed.** (NEPA/UNICAMP, Ministerio de Salud), útil para alimentos tropicales
3. **Extras de productos de marca**:
   - USDA Branded: datos de etiqueta enviados por los fabricantes.
   - Open Food Facts: colaborativo, **no gubernamental**. Filtré ambos (detalle abajo), pero no son datos de laboratorio.

No se usaron redes sociales ni webs de terceros como fuente de valores, porque no son verificables.

## Cómo se verificó

**Integridad del pipeline.** Se re‑leyeron 45 alimentos al azar (15 por cada sub‑base del USDA) directamente de los CSV oficiales. Los 45 coinciden con la base final: proteína, grasa y carbohidratos exactos (solo redondeo a 3 decimales).

**Controles internos (13.552 alimentos).**
- Se compara la energía con los macros (Atwater).
- Se revisa que los macros sumen ≤ 100 g.
- Los carbohidratos negativos del cálculo "por diferencia" se ajustan a 0.
- Los 43 casos de energía atípica quedan marcados en `alertas_calidad`. Casi todos son alcohol o alimentos muy altos en fibra, donde es normal.
- Se excluyeron 75 registros del USDA a los que les faltaban macros.

**Verificación cruzada (649 alimentos populares).** Cada alimento se emparejó con el mismo alimento, en el mismo estado (crudo, cocido o frito), en UK, AU y BR. Se considera que una fuente "coincide" cuando se cumplen todas estas tolerancias:

| Nutriente | Tolerancia |
|---|---|
| kcal | ±15 % o ±25 kcal |
| Proteína | ±20 % o ±2 g |
| Grasa | ±25 % o ±2 g |
| Carbohidratos disponibles | ±20 % o ±3 g |

Resultado de la verificación:

| Estado | Alimentos |
|---|---|
| verificado (todas coinciden) | 151 |
| verificado (1 fuente) | 113 |
| verificado (mayoría) | 82 |
| verificado parcial | 15 |
| difiere entre fuentes | 102 |
| fuente única (USDA) | 186 |

"Fuente única" significa que ninguna otra tabla oficial tiene ese alimento. Es el caso de muchos platos latinos y cortes específicos.

**Valor recomendado.**
- Si las fuentes coinciden, se usa el valor del USDA.
- Si difieren y hay 3 o más fuentes, se usa **el perfil completo de la fuente cuyo valor de kcal es el central**. Así kcal y macros siguen siendo coherentes entre sí.
- La columna `valor_recomendado_origen` indica de dónde sale cada valor, y `min_*`/`max_*` muestran el rango entre fuentes.

Que las fuentes "difieran" suele ser variación real: variedad, humedad tras la cocción o método analítico. Por ejemplo, el arroz cocido absorbe distinta cantidad de agua, y la fibra se mide con AOAC o con NSP. No significa que los datos estén mal.

**Filtros de los extras de marca.** Se descartaron los productos que no cumplían alguna de estas condiciones:
- Tener nombre y los 4 macros (kcal, proteína, grasa, carbohidratos).
- kcal ≤ 902 y macros que suman ≤ 101 g.
- kcal coherentes con 4‑9‑4 (±20 % o ±30 kcal).
- En Open Food Facts, sin errores de calidad marcados. En USDA, solo productos no descontinuados.

Se eliminaron códigos de barras duplicados y se quedó el registro más reciente.

## Cómo usarlo en la app (para Codex)

```sql
-- Buscar (ignora acentos; nombre, sinónimos y nombre en inglés). Populares primero, sin duplicados
SELECT v.id, v.nombre_es, v.kcal, v.proteina_g, v.carbohidratos_g, v.grasa_g, v.fibra_g, v.estado_verificacion
FROM buscar b JOIN alimentos_app v ON v.id = b.id
WHERE buscar MATCH 'habichuelas' AND v.es_preferido = 1
ORDER BY v.es_popular DESC, rank LIMIT 20;

-- Porciones de un alimento
SELECT porcion_es, gramos FROM porciones WHERE alimento_id = 'US173735';

-- Macros para X gramos
-- valor = valor_100g * gramos / 100
```

- La vista `alimentos_app` ya aplica los valores de `populares_rd` (verificados) cuando existen; úsala en lugar de `alimentos` para mostrar macros y `alimento_id` para enlazar porciones y micronutrientes.
- `id` empieza por `US` + fdc_id del USDA. Puedes consultar cualquier alimento en `https://fdc.nal.usda.gov/food-details/<fdc_id>/nutrients`.
- Para escanear códigos de barras: `productos_marca_usda` (columna `codigo_barras` = GTIN/UPC) y luego Open Food Facts.

## Licencias y atribución (importante si vas a vender la app)

- **USDA (base principal y marcas):** dominio público. Uso comercial libre. Se recomienda citar "USDA FoodData Central".
- **UK CoFID:** Open Government Licence v3.0. Uso comercial permitido. Incluye: *"Contains public sector information licensed under the Open Government Licence v3.0."*
- **AFCD (Australia) y TACO (Brasil):** se usaron para verificar. En 97 alimentos populares (41 UK, 39 AU, 17 BR) el valor recomendado sale de UK, AU o BR (lo indica `valor_recomendado_origen`). Antes de publicar, revisa los términos de FSANZ y cita a NEPA/UNICAMP. Si prefieres evitarlo, usa solo los valores USDA de `alimentos`.
- **Open Food Facts:** ODbL 1.0. Uso comercial permitido, pero exige:
  - atribución visible ("Datos de Open Food Facts");
  - que cualquier base derivada que distribuyas quede también bajo ODbL.

  Mantenla en una tabla separada.

*No soy abogado; revisa las licencias antes de lanzar la app.*

## Limitaciones conocidas

- Las traducciones al español se hicieron por lotes. Revisé muestras y la calidad es buena, pero algunos nombres largos de cortes de carne pueden sonar literales.
- No hay una tabla oficial dominicana descargable. Algunos alimentos típicos usan su equivalente más cercano del USDA, y la columna `nota` lo indica:
  - salami dominicano = salami cocido de res y cerdo
  - queso de freír = queso blanco
  - mangú = plátano verde hervido, sin grasa añadida
- Los suplementos (whey, etc.) varían mucho por marca. El registro USDA de "whey aislado" tiene solo 58 g de proteína, así que es mejor usar la etiqueta o el código de barras.
- El bacalao desalado no está en el USDA. Referencia UK: 138 kcal, 32,5 g de proteína y 0,9 g de grasa por 100 g, hervido.

## Cambios de la v2 (auditoría del 5‑nov‑2026)

- Nombres duplicados: nuevas columnas `es_popular` / `es_preferido` (prioridad popular > Foundation > SR Legacy > FNDDS). Filtra con `es_preferido=1`.
- 542 alimentos sin porción: se añadieron «100 g» y «1 oz (28,35 g)» marcadas `origen='conversión de peso'` (no son medidas caseras reales).
- Búsqueda `buscar`: ahora una fila por alimento (antes devolvía resultados repetidos para los populares).
- «Pan de fruta»: la fuente UK no reporta fibra, así que se usa el perfil USDA completo.
- Carbohidratos «por diferencia» ligeramente negativos en populares: ajustados a 0 (como en `alimentos.csv`).
- Nueva vista/CSV `alimentos_app`.
- v2.1: 48 registros no populares (p. ej. «Aceite de oliva» FNDDS) quedan con `es_preferido=0` porque su nombre coincidía con el de un popular; ya no hay nombres repetidos entre los preferidos.
- Los 18 controles automáticos de integridad pasan (conteos, huérfanos, negativos, CSV = SQLite).
- `azucares_anadidos_g` está vacío por diseño: el USDA lo publica solo para productos de marca. Un valor vacío significa «no disponible», nunca cero.

## Notas de datos

- En los valores de UK, AU y BR, los carbohidratos incluyen la fibra y las kcal no suman su energía; por eso kcal y macros no cuadran con Atwater 4‑9‑4 (es coherente con esas tablas).
- 38 populares tienen `fibra_g` vacía (el USDA no la reporta para ese registro, o la fuente BR/TACO no la trae). Es «no disponible», no cero.
- La carpeta `data/` contiene solo la base y los CSV de este zip; el .xlsx y los `.gz` de marcas están en los otros zips.

## Pendiente / no verificado

- Canadian Nutrient File (descarga fallida) y Frida (Dinamarca) no incluidos.
- Términos de licencia de AFCD (Australia) no verificados: confírmalos antes de redistribuir esos valores en una app comercial.
