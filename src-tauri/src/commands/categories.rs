use chrono::{SecondsFormat, Utc};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::db::Db;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub parent_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryCreateInput {
    pub name: String,
    pub kind: String, // income | expense
    pub parent_id: Option<String>,
}

fn now_rfc3339() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

#[tauri::command]
pub fn category_list(db: State<'_, Db>, kind: Option<String>) -> Result<Vec<Category>, String> {
    let conn = db.0.lock().map_err(|_| "db lock poisoned".to_string())?;

    let mut out = Vec::new();
    match kind {
        Some(k) => {
            let mut stmt = conn
                .prepare(
                    r#"
                    SELECT id, name, kind, parent_id
                    FROM categories
                    WHERE deleted_at IS NULL AND kind = ?1
                    ORDER BY name ASC;
                    "#,
                )
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map([k], |row| {
                    Ok(Category {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        kind: row.get(2)?,
                        parent_id: row.get(3)?,
                    })
                })
                .map_err(|e| e.to_string())?;
            for r in rows {
                out.push(r.map_err(|e| e.to_string())?);
            }
        }
        None => {
            let mut stmt = conn
                .prepare(
                    r#"
                    SELECT id, name, kind, parent_id
                    FROM categories
                    WHERE deleted_at IS NULL
                    ORDER BY kind ASC, name ASC;
                    "#,
                )
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map([], |row| {
                    Ok(Category {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        kind: row.get(2)?,
                        parent_id: row.get(3)?,
                    })
                })
                .map_err(|e| e.to_string())?;
            for r in rows {
                out.push(r.map_err(|e| e.to_string())?);
            }
        }
    }

    Ok(out)
}

#[tauri::command]
pub fn category_create(db: State<'_, Db>, input: CategoryCreateInput) -> Result<Category, String> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err("name is required".to_string());
    }
    let kind = input.kind.trim();
    if kind != "income" && kind != "expense" {
        return Err("kind must be 'income' or 'expense'".to_string());
    }

    let id = Uuid::new_v4().to_string();
    let now = now_rfc3339();

    let conn = db.0.lock().map_err(|_| "db lock poisoned".to_string())?;
    conn.execute(
        r#"
        INSERT INTO categories (id, name, kind, parent_id, created_at, updated_at, deleted_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL);
        "#,
        params![id, name, kind, input.parent_id, now, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(Category {
        id,
        name: name.to_string(),
        kind: kind.to_string(),
        parent_id: input.parent_id,
    })
}
