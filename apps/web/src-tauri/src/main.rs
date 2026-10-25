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
async fn print_thermal(
    printer_name: String,
    text: String,
    columns: u8,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        tauri::async_runtime::spawn_blocking(move || thermal::print(&printer_name, &text, columns, false))
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
    sale_id: Option<String>,
    movement_id: Option<String>,
    automatic: bool,
    reason: Option<String>,
) -> Result<(), String> {
    let authorization = authorize_drawer(
        &access_token,
        sale_id.as_deref(),
        movement_id.as_deref(),
        automatic,
        reason.as_deref(),
    )
    .await?;
    let Some(audit_id) = authorization else {
        return Ok(());
    };
    pulse(printer_name).await?;
    // CPC-10: la bitácora marca «enviado» solo cuando este equipo dio el
    // pulso; sin esa marca la cajera puede reintentar la misma venta una vez.
    if automatic {
        let _ = post_drawer(
            &access_token,
            "/api/cash-sessions/drawer-open/automatic/sent",
            serde_json::json!({ "auditId": audit_id }).to_string(),
        )
        .await;
    }
    Ok(())
}

async fn pulse(printer_name: String) -> Result<(), String> {
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

/// Lee la respuesta de la API. Falla cerrado: solo `open:true` con un
/// `auditId` válido abre; la manual (sin `open`) abre si trae `auditId`.
fn drawer_audit_id(body: &str, automatic: bool) -> Option<String> {
    let value: serde_json::Value = serde_json::from_str(body).ok()?;
    if automatic && value.get("open") != Some(&serde_json::Value::Bool(true)) {
        return None;
    }
    let id = value.get("auditId")?.as_str()?;
    valid_reference(id).then(|| id.to_string())
}

async fn post_drawer(access_token: &str, route: &str, body: String) -> Result<String, String> {
    let origin = option_env!("NEXORA_PRODUCT_URL")
        .ok_or("Falta el origen aprobado de Nexora para autorizar la gaveta.")?;
    let response = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|_| "No se pudo preparar la autorización de la gaveta.")?
        .post(format!("{origin}{route}"))
        .bearer_auth(access_token)
        .header("content-type", "application/json")
        .body(body)
        .send()
        .await
        .map_err(|_| "No se pudo registrar la apertura de la gaveta.")?;
    if !response.status().is_success() {
        return Err("La API rechazó la apertura de la gaveta.".into());
    }
    response
        .text()
        .await
        .map_err(|_| "La API no confirmó la apertura de la gaveta.".into())
}

async fn authorize_drawer(
    access_token: &str,
    sale_id: Option<&str>,
    movement_id: Option<&str>,
    automatic: bool,
    reason: Option<&str>,
) -> Result<Option<String>, String> {
    if automatic && (sale_id.is_none() || movement_id.is_some()) {
        return Err("La apertura automática requiere una venta en efectivo.".into());
    }
    let mut reference = match (sale_id, movement_id) {
        (Some(value), None) if valid_reference(value) => serde_json::json!({ "saleId": value }),
        (None, Some(value)) if valid_reference(value) => serde_json::json!({ "movementId": value }),
        _ => return Err("Indica una venta o un movimiento de caja válido.".into()),
    };
    if !automatic {
        reference["reason"] = serde_json::Value::String(reason.unwrap_or("").to_string());
    }
    if access_token.is_empty() {
        return Err("La sesión no permite autorizar la gaveta.".into());
    }
    let route = if automatic {
        "/api/cash-sessions/drawer-open/automatic"
    } else {
        "/api/cash-sessions/drawer-open"
    };
    let body = post_drawer(access_token, route, reference.to_string()).await?;
    Ok(drawer_audit_id(&body, automatic))
}

#[cfg(test)]
mod audit_tests {
    use super::{drawer_audit_id, valid_reference};

    #[test]
    fn drawer_opens_only_with_a_confirmed_audit() {
        let id = "550e8400-e29b-41d4-a716-446655440000";
        let open = format!(r#"{{"auditId":"{id}","open":true}}"#);
        assert_eq!(drawer_audit_id(&open, true).as_deref(), Some(id));
        assert_eq!(drawer_audit_id(&format!(r#"{{"auditId":"{id}","open":false}}"#), true), None);
        assert_eq!(drawer_audit_id(r#"{"open":true}"#, true), None);
        assert_eq!(drawer_audit_id("no es json", true), None);
        assert_eq!(drawer_audit_id(&format!(r#"{{"auditId":"{id}"}}"#), false).as_deref(), Some(id));
    }

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
