fn main() {
    println!("cargo:rerun-if-env-changed=NEXORA_PRODUCT_URL");
    if matches!(std::env::var("PROFILE"), Ok(profile) if profile == "release")
        && std::env::var("NEXORA_PRODUCT_URL").is_err()
    {
        panic!("NEXORA_PRODUCT_URL es obligatorio para empaquetar Nexora POS Desktop.");
    }
    tauri_build::build();
}
