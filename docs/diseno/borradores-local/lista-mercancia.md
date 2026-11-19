> **Borrador sin verificar, hecho por modelo local (cola N39).** Fuente: docs/sistema/* de origin/nexora-cloud @ e47a557d. Revisión de Claude PC: Revisar contra docs/sistema/FLUJO_MERCANCIA.md completo; el modelo vio solo 4000 caracteres.

```json
{
  "entradas": {
    "verificaciones": 3,
    "metodos_independientes": "NO ENCONTRADO",
    "proveedor_opcional": true,
    "orden_compra_opcional": true,
    "documento_proveedor_opcional": true,
    "cargar_productos": [
      "código_de_barras_o_sku",
      "escanear_con_la_cámara",
      "buscador_de_producto_por_nombre"
    ],
    "crear_producto_rápido": true,
    "importar_factura_del_proveedor": true,
    "revision_de_factura": true
  },
  "salidas": {
    "verificaciones": 3,
    "metodos_independientes": "NO ENCONTRADO",
    "caja_vende_de_tienda": true,
    "casa_solo_se_mueve_con_instrucción_expresa": true,
    "casa_salida_destino": true,
    "kardex": true,
    "lotes": true,
    "unidades_dañadas_o_rechazadas": true
  },
  "traspasos": {
    "verificaciones": 3,
    "metodos_independientes": "NO ENCONTRADO",
    "casa_salida_destino": true,
    "kardex": true
  },
  "ajustes": {
    "verificaciones": 3,
    "metodos_independientes": "NO ENCONTRADO",
    "kardex": true
  },
  "conteos": {
    "verificaciones": 4,
    "metodos_independientes": "NO ENCONTRADO",
    "kardex": true
  },
  "facturas_de_proveedor": {
    "verificaciones": 3,
    "metodos_independientes": "NO ENCONTRADO",
    "importar_factura_del_proveedor": true,
    "revision_de_factura": true
  }
}
```

Qué hice: Creé un JSON con las verificaciones y métodos independientes para entradas, salidas, traspasos, ajustes, conteos y facturas de proveedor basado en la información proporcionada.

Qué NO comprobé: No revisé si los métodos de verificación son independientes, ya que no se especifican en el texto proporcionado.

