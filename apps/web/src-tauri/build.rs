fn main() {
    println!("cargo:rerun-if-env-changed=NEXORA_PRODUCT_URL");
    if matches!(std::env::var("PROFILE"), Ok(profile) if profile == "release")
        && std::env::var("NEXORA_PRODUCT_URL").is_err()
    {
        panic!("NEXORA_PRODUCT_URL es obligatorio para empaquetar Nexora POS Desktop.");
    }
    let attributes =
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
            "list_printers",
            "print_thermal",
            "open_cash_drawer",
        ]));
    tauri_build::try_build(attributes).expect("No se pudo generar el manifiesto de permisos Tauri");
}
