// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod commands;
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
        .plugin(tauri_plugin_biometric::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let db = Db::open(&app.handle())?;
            app.manage(db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db_location,
            commands::accounts::account_count,
            commands::accounts::account_list,
            commands::accounts::account_create,
            commands::accounts::account_set_default,
            commands::accounts::account_archive,
            commands::accounts::account_unarchive,
            commands::accounts::account_delete,
            commands::categories::category_list,
            commands::categories::category_create,
            commands::dashboard::dashboard_month_summary,
            commands::security::security_state,
            commands::security::security_set_lock_enabled,
            commands::security::security_set_biometric_enabled,
            commands::security::security_set_pattern,
            commands::security::security_verify_pattern,
            commands::transactions::transaction_list,
            commands::transactions::transaction_create_expense_income,
            commands::transactions::transaction_create_transfer,
            commands::transactions::transaction_create_give_receive,
            commands::debts::debt_list,
            commands::debts::debt_create,
            commands::debts::debt_set_status,
            commands::debts::debt_delete,
            commands::debts::debt_payment_add,
            commands::debts::debt_payment_list,
            commands::contacts::contact_list,
            commands::contacts::contact_create,
            commands::contacts::contact_delete
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
