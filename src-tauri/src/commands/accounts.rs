use chrono::{SecondsFormat, Utc};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::db::Db;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: String,
    pub name: String,
    pub r#type: String,
    pub currency: String,
    pub is_default: bool,
    pub usage_count: u64,
    pub is_archived: bool,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountCreateInput {
    pub name: String,
    pub r#type: String,
    pub currency: Option<String>,
}

fn now_rfc3339() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn default_account_id(conn: &rusqlite::Connection) -> Result<Option<String>, String> {
    conn.query_row(
        "SELECT value FROM app_settings WHERE key = 'default_account_id' LIMIT 1;",
        [],
        |row| row.get::<_, String>(0),
    )
    .optional()
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn account_count(db: State<'_, Db>) -> Result<u64, String> {
    let conn = db.0.lock().map_err(|_| "db lock poisoned".to_string())?;
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(1) FROM accounts WHERE deleted_at IS NULL;",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(count.max(0) as u64)
}

#[tauri::command]
pub fn account_list(db: State<'_, Db>) -> Result<Vec<Account>, String> {
    let conn = db.0.lock().map_err(|_| "db lock poisoned".to_string())?;

    let default_id = default_account_id(&conn)?;

    let mut stmt = conn
        .prepare(
            r#"
            SELECT
              a.id, a.name, a.type, a.currency,
              a.created_at, a.updated_at, a.deleted_at,
              (
                SELECT COUNT(1)
                FROM transactions t
                WHERE t.deleted_at IS NULL
                  AND (t.account_id = a.id OR t.from_account_id = a.id OR t.to_account_id = a.id)
              ) AS usage_count
            FROM accounts
            a
            ORDER BY a.created_at ASC;
            "#,
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let usage: i64 = row.get(7)?;
            let deleted_at: Option<String> = row.get(6)?;
            Ok(Account {
                is_default: default_id.as_deref() == Some(id.as_str()),
                usage_count: usage.max(0) as u64,
                is_archived: deleted_at.is_some(),
                id,
                name: row.get(1)?,
                r#type: row.get(2)?,
                currency: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                deleted_at,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
pub fn account_create(db: State<'_, Db>, input: AccountCreateInput) -> Result<Account, String> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err("name is required".to_string());
    }

    let t = input.r#type.trim();
    if t.is_empty() {
        return Err("type is required".to_string());
    }

    // Default currency: Cameroon uses XAF.
    let currency = input
        .currency
        .unwrap_or_else(|| "XAF".to_string())
        .trim()
        .to_string();
    if currency.is_empty() {
        return Err("currency is required".to_string());
    }

    let id = Uuid::new_v4().to_string();
    let now = now_rfc3339();

    let conn = db.0.lock().map_err(|_| "db lock poisoned".to_string())?;
    conn.execute(
        r#"
        INSERT INTO accounts (id, name, type, currency, created_at, updated_at, deleted_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL);
        "#,
        params![id, name, t, currency, now, now],
    )
    .map_err(|e| e.to_string())?;

    // If there's no default account yet, set this new one as default.
    let has_default = default_account_id(&conn)?.is_some();
    if !has_default {
        conn.execute(
            r#"
            INSERT INTO app_settings (key, value) VALUES ('default_account_id', ?1)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value;
            "#,
            params![id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(Account {
        id,
        name: name.to_string(),
        r#type: t.to_string(),
        currency,
        is_default: !has_default,
        usage_count: 0,
        is_archived: false,
        created_at: now.clone(),
        updated_at: now,
        deleted_at: None,
    })
}

#[tauri::command]
pub fn account_set_default(db: State<'_, Db>, account_id: String) -> Result<(), String> {
    let id = account_id.trim().to_string();
    if id.is_empty() {
        return Err("accountId is required".to_string());
    }
    let conn = db.0.lock().map_err(|_| "db lock poisoned".to_string())?;

    // Ensure account exists and is active.
    let exists: Option<String> = conn
        .query_row(
            "SELECT id FROM accounts WHERE id = ?1 AND deleted_at IS NULL;",
            [id.clone()],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    if exists.is_none() {
        return Err("account not found".to_string());
    }

    conn.execute(
        r#"
        INSERT INTO app_settings (key, value) VALUES ('default_account_id', ?1)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value;
        "#,
        params![id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn account_archive(db: State<'_, Db>, account_id: String) -> Result<(), String> {
    let id = account_id.trim().to_string();
    if id.is_empty() {
        return Err("accountId is required".to_string());
    }
    let conn = db.0.lock().map_err(|_| "db lock poisoned".to_string())?;
    let now = now_rfc3339();

    let changed = conn
        .execute(
            "UPDATE accounts SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1 AND deleted_at IS NULL;",
            params![id, now],
        )
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        return Err("account not found (or already archived)".to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn account_unarchive(db: State<'_, Db>, account_id: String) -> Result<(), String> {
    let id = account_id.trim().to_string();
    if id.is_empty() {
        return Err("accountId is required".to_string());
    }
    let conn = db.0.lock().map_err(|_| "db lock poisoned".to_string())?;
    let now = now_rfc3339();

    let changed = conn
        .execute(
            "UPDATE accounts SET deleted_at = NULL, updated_at = ?2 WHERE id = ?1 AND deleted_at IS NOT NULL;",
            params![id, now],
        )
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        return Err("account not found (or not archived)".to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn account_delete(db: State<'_, Db>, account_id: String) -> Result<(), String> {
    let id = account_id.trim().to_string();
    if id.is_empty() {
        return Err("accountId is required".to_string());
    }
    let conn = db.0.lock().map_err(|_| "db lock poisoned".to_string())?;

    let usage: i64 = conn
        .query_row(
            r#"
            SELECT COUNT(1)
            FROM transactions t
            WHERE t.deleted_at IS NULL
              AND (t.account_id = ?1 OR t.from_account_id = ?1 OR t.to_account_id = ?1);
            "#,
            [id.clone()],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if usage > 0 {
        return Err("cannot delete: account has transactions".to_string());
    }

    conn.execute("DELETE FROM accounts WHERE id = ?1;", [id.clone()])
        .map_err(|e| e.to_string())?;

    // Clear default if it was pointing here.
    let current_default = default_account_id(&conn)?;
    if current_default.as_deref() == Some(id.as_str()) {
        conn.execute(
            "DELETE FROM app_settings WHERE key = 'default_account_id';",
            [],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}
