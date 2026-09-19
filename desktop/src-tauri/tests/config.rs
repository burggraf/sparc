use std::{fs, path::Path};

use serde_json::Value;

fn json(path: &Path) -> Value {
    serde_json::from_slice(&fs::read(path).unwrap()).unwrap()
}

#[test]
fn local_bundle_is_adhoc_and_renderer_capabilities_are_narrow() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"));
    let config = json(&root.join("tauri.conf.json"));
    assert_eq!(config["bundle"]["macOS"]["signingIdentity"], "-");
    assert!(config["app"]["security"]["csp"].as_str().is_some());

    let capability = json(&root.join("capabilities/default.json"));
    assert_eq!(capability["windows"], serde_json::json!(["main"]));
    assert_eq!(
        capability["permissions"],
        serde_json::json!(["core:default", "dialog:allow-open", "dialog:allow-save"])
    );
}
