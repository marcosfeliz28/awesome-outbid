#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "windows")]
mod thermal;

#[tauri::command]
fn list_printers() -> Result<Vec<String>, String> {
    #[cfg(target_os = "windows")]
    {
        thermal::list_printers()
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("La impresión térmica directa requiere Windows.".into())
    }
}

#[tauri::command]
async fn print_thermal(printer_name: String, text: String, columns: u8) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        tauri::async_runtime::spawn_blocking(move || {
            thermal::print(&printer_name, &text, columns, false)
        })
        .await
        .map_err(|_| "No se pudo completar el trabajo de impresión.".to_string())?
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (printer_name, text, columns);
        Err("La impresión térmica directa requiere Windows.".into())
    }
}

#[tauri::command]
async fn open_cash_drawer(
    printer_name: String,
    access_token: String,
    mode: String,
    operation_id: String,
    reason: String,
    sale_id: Option<String>,
    movement_id: Option<String>,
) -> Result<(), String> {
    authorize_drawer(
        &access_token,
        &mode,
        &operation_id,
        &reason,
        sale_id.as_deref(),
        movement_id.as_deref(),
    )
    .await?;
    #[cfg(target_os = "windows")]
    {
        tauri::async_runtime::spawn_blocking(move || thermal::open_drawer(&printer_name))
            .await
            .map_err(|_| "No se pudo abrir la gaveta.".to_string())?
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = printer_name;
        Err("La gaveta requiere Windows.".into())
    }
}

fn valid_reference(value: &str) -> bool {
    value.len() == 36
        && value.bytes().enumerate().all(|(index, byte)| {
            if matches!(index, 8 | 13 | 18 | 23) {
                byte == b'-'
            } else {
                byte.is_ascii_hexdigit()
            }
        })
}

async fn authorize_drawer(
    access_token: &str,
    mode: &str,
    operation_id: &str,
    reason: &str,
    sale_id: Option<&str>,
    movement_id: Option<&str>,
) -> Result<(), String> {
    let (sale_id, movement_id) = match (sale_id, movement_id) {
        (Some(value), None) if valid_reference(value) => (Some(value), None),
        (None, Some(value)) if valid_reference(value) => (None, Some(value)),
        _ => return Err("Indica una venta o un movimiento de caja válido.".into()),
    };
    if !valid_reference(operation_id) {
        return Err("La autorización de gaveta no es válida.".into());
    }
    if !matches!(mode, "automatic" | "manual") || reason.trim().len() < 3 {
        return Err("Indica un motivo válido para abrir la gaveta.".into());
    }
    let reference = serde_json::json!({
        "mode": mode,
        "operationId": operation_id,
        "reason": reason,
        "saleId": sale_id,
        "movementId": movement_id,
    });
    if access_token.is_empty() {
        return Err("La sesión no permite autorizar la gaveta.".into());
    }
    let origin = option_env!("NEXORA_PRODUCT_URL")
        .ok_or("Falta el origen aprobado de Nexora para autorizar la gaveta.")?;
    let response = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|_| "No se pudo preparar la autorización de la gaveta.")?
        .post(format!("{origin}/api/cash-sessions/drawer-open"))
        .bearer_auth(access_token)
        .header("content-type", "application/json")
        .json(&reference)
        .send()
        .await
        .map_err(|_| "No se pudo registrar la apertura de la gaveta.")?;
    if !response.status().is_success() {
        return Err("La API rechazó la apertura de la gaveta.".into());
    }
    Ok(())
}

#[cfg(test)]
mod audit_tests {
    use super::valid_reference;

    #[test]
    fn drawer_requires_a_real_reference_uuid() {
        assert!(valid_reference("550e8400-e29b-41d4-a716-446655440000"));
        assert!(!valid_reference(""));
        assert!(!valid_reference("550e8400-e29b-41d4-a716-44665544000z"));
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            list_printers,
            print_thermal,
            open_cash_drawer
        ])
        .run(tauri::generate_context!())
        .expect("No se pudo iniciar Nexora POS");
}
