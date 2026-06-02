use chrono::{SecondsFormat, Utc};
use rusqlite::params;
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

    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, name, type, currency, created_at, updated_at, deleted_at
            FROM accounts
            WHERE deleted_at IS NULL
            ORDER BY created_at ASC;
            "#,
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Account {
                id: row.get(0)?,
                name: row.get(1)?,
                r#type: row.get(2)?,
                currency: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                deleted_at: row.get(6)?,
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

    Ok(Account {
        id,
        name: name.to_string(),
        r#type: t.to_string(),
        currency,
        created_at: now.clone(),
        updated_at: now,
        deleted_at: None,
    })
}

