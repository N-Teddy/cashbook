// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod db;
mod error;

use db::Db;
use tauri::Manager;

#[tauri::command]
fn db_location(app: tauri::AppHandle) -> Result<String, String> {
    db::db_path(&app)
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let db = Db::open(&app.handle())?;
            app.manage(db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![db_location])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
