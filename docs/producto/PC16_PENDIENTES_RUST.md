# PC-16: cambios pendientes en Rust (no compilados en este equipo)

Esta PC no tiene Rust/cargo. Estos cambios los debe aplicar y compilar ChatGPT PC.

## 1. Enviar el motivo de la apertura manual (obligatorio desde el commit 2)

La API ahora responde 400 a `POST /api/cash-sessions/drawer-open` si falta `reason`
(mínimo 5 caracteres). El cliente web ya envía `reason` como argumento de
`open_cash_drawer`; Tauri ignora argumentos desconocidos, así que **hasta aplicar este
parche la apertura manual falla con 400**.

Archivo `apps/web/src-tauri/src/main.rs`:

- `open_cash_drawer`: añadir el parámetro `reason: Option<String>` (tras `automatic: bool`)
  y pasarlo: `authorize_drawer(&access_token, sale_id.as_deref(), movement_id.as_deref(), automatic, reason.as_deref())`.
- `authorize_drawer`: añadir `reason: Option<&str>` y construir el cuerpo con serde_json
  (evita JSON roto por comillas):

Antes:
```rust
let reference = match (sale_id, movement_id) {
    (Some(value), None) if valid_reference(value) => format!(r#"{{"saleId":"{value}"}}"#),
    (None, Some(value)) if valid_reference(value) => format!(r#"{{"movementId":"{value}"}}"#),
    _ => return Err("Indica una venta o un movimiento de caja válido.".into()),
};
```
Después:
```rust
let key = match (sale_id, movement_id) {
    (Some(v), None) if valid_reference(v) => ("saleId", v),
    (None, Some(v)) if valid_reference(v) => ("movementId", v),
    _ => return Err("Indica una venta o un movimiento de caja válido.".into()),
};
let mut json = serde_json::json!({ key.0: key.1 });
if !automatic {
    let r = reason.map(str::trim).unwrap_or("");
    if r.chars().count() < 5 { return Err("Indica el motivo de la apertura (mínimo 5 caracteres).".into()); }
    json["reason"] = serde_json::Value::String(r.to_string());
}
let reference = json.to_string();
```
(Añadir `serde_json` a Cargo.toml si aún no está.)

## 2. Reintento de la apertura automática (commit 3)

Sin cambios obligatorios: el contrato `{"open":true}` no cambia. Opcional: si
`open_cash_drawer` falla tras autorizar, el cliente puede reintentar en 30 s y la API
volverá a responder `open:true`.
