mod archive;

use std::{path::PathBuf, vec};

use archive::{ArchiveSummary, OperationState, UiError};
use tauri::State;

#[tauri::command]
async fn create_archive(
    state: State<'_, OperationState>,
    source: String,
    archive: String,
    identity: String,
) -> Result<ArchiveSummary, UiError> {
    let guard = state.start()?;
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = guard;
        archive::create_archive(
            &PathBuf::from(source),
            &PathBuf::from(archive),
            &PathBuf::from(identity),
        )
    })
    .await
    .map_err(|_| UiError::internal(vec!["selected outputs"]))?
}

#[tauri::command]
async fn verify_archive(
    state: State<'_, OperationState>,
    archive: String,
    identity: String,
) -> Result<ArchiveSummary, UiError> {
    let guard = state.start()?;
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = guard;
        archive::verify_archive(&PathBuf::from(archive), &PathBuf::from(identity))
    })
    .await
    .map_err(|_| UiError::internal(Vec::new()))?
}

#[tauri::command]
async fn restore_archive(
    state: State<'_, OperationState>,
    archive: String,
    identity: String,
    destination: String,
) -> Result<ArchiveSummary, UiError> {
    let guard = state.start()?;
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = guard;
        archive::restore_archive(
            &PathBuf::from(archive),
            &PathBuf::from(identity),
            &PathBuf::from(destination),
        )
    })
    .await
    .map_err(|_| UiError::internal(vec!["partial restore"]))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(OperationState::default())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            create_archive,
            verify_archive,
            restore_archive
        ])
        .run(tauri::generate_context!())
        .expect("error while running SPARC");
}
