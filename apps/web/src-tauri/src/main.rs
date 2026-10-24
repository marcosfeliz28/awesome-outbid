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
    open_drawer: bool,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        tauri::async_runtime::spawn_blocking(move || {
            thermal::print(&printer_name, &text, columns, open_drawer)
        })
        .await
        .map_err(|_| "No se pudo completar el trabajo de impresión.".to_string())?
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (printer_name, text, columns, open_drawer);
        Err("La impresión térmica directa requiere Windows.".into())
    }
}

#[tauri::command]
async fn open_cash_drawer(printer_name: String) -> Result<(), String> {
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
