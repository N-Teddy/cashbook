use chrono::{SecondsFormat, Utc};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::db::Db;

fn now_rfc3339() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContactRow {
    pub id: String,
    pub name: String,
    pub note: Option<String>,
    /// Total open outstanding across all debts for this contact (signed:
    /// positive = net they owe me, negative = net I owe them).
    pub net_balance_minor: i64,
    /// Currency of the net_balance_minor value (first currency found, or "XAF").
    /// For multi-currency contacts this is informational only — UI should
    /// load per-debt detail for accuracy.
    pub primary_currency: String,
    /// Count of open debts for this contact.
    pub open_debt_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContactCreateInput {
    pub name: String,
    pub note: Option<String>,
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn contact_list(db: State<'_, Db>) -> Result<Vec<ContactRow>, String> {
    let conn = db.0.lock().map_err(|_| "db lock poisoned".to_string())?;

    // Get all non-deleted contacts with their summary stats.
    let mut stmt = conn
        .prepare(
            r#"
            SELECT
              c.id,
              c.name,
              c.note,
              c.created_at,
              c.updated_at,
              -- Net balance: owed_to_me is positive, owed_by_me is negative
              COALESCE((
                SELECT SUM(
                  CASE d.kind
                    WHEN 'owed_to_me' THEN
                      d.principal_minor - COALESCE(
                        (SELECT SUM(p.amount_minor) FROM debt_payments p
                         WHERE p.debt_id = d.id AND p.deleted_at IS NULL), 0)
                    ELSE
                      -(d.principal_minor - COALESCE(
                        (SELECT SUM(p.amount_minor) FROM debt_payments p
                         WHERE p.debt_id = d.id AND p.deleted_at IS NULL), 0))
                  END
                )
                FROM debts d
                WHERE d.contact_id = c.id
                  AND d.deleted_at IS NULL
                  AND d.status = 'open'
              ), 0) AS net_balance_minor,
              -- Primary currency (first debt currency found, fallback XAF)
              COALESCE((
                SELECT d.currency FROM debts d
                WHERE d.contact_id = c.id AND d.deleted_at IS NULL
                ORDER BY d.opened_at DESC LIMIT 1
              ), 'XAF') AS primary_currency,
              -- Open debt count
              COALESCE((
                SELECT COUNT(1) FROM debts d
                WHERE d.contact_id = c.id AND d.deleted_at IS NULL AND d.status = 'open'
              ), 0) AS open_debt_count
            FROM contacts c
            WHERE c.deleted_at IS NULL
            ORDER BY c.name ASC;
            "#,
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(ContactRow {
                id: row.get(0)?,
                name: row.get(1)?,
                note: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                net_balance_minor: row.get(5)?,
                primary_currency: row.get(6)?,
                open_debt_count: row.get(7)?,
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
pub fn contact_create(
    db: State<'_, Db>,
    input: ContactCreateInput,
) -> Result<ContactRow, String> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err("name is required".to_string());
    }

    let id = Uuid::new_v4().to_string();
    let now = now_rfc3339();

    let conn = db.0.lock().map_err(|_| "db lock poisoned".to_string())?;
    conn.execute(
        r#"
        INSERT INTO contacts (id, name, note, created_at, updated_at, deleted_at)
        VALUES (?1, ?2, ?3, ?4, ?4, NULL);
        "#,
        params![id, name, input.note, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(ContactRow {
        id,
        name,
        note: input.note,
        net_balance_minor: 0,
        primary_currency: "XAF".to_string(),
        open_debt_count: 0,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn contact_delete(db: State<'_, Db>, contact_id: String) -> Result<(), String> {
    let id = contact_id.trim().to_string();
    if id.is_empty() {
        return Err("contactId is required".to_string());
    }

    let conn = db.0.lock().map_err(|_| "db lock poisoned".to_string())?;

    // Check contact exists
    let exists: Option<String> = conn
        .query_row(
            "SELECT id FROM contacts WHERE id = ?1 AND deleted_at IS NULL;",
            [id.clone()],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    if exists.is_none() {
        return Err("contact not found".to_string());
    }

    // Refuse if they have open debts
    let open: i64 = conn
        .query_row(
            "SELECT COUNT(1) FROM debts WHERE contact_id = ?1 AND deleted_at IS NULL AND status = 'open';",
            [id.clone()],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if open > 0 {
        return Err("cannot delete: contact has open debts".to_string());
    }

    let now = now_rfc3339();
    conn.execute(
        "UPDATE contacts SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2;",
        params![now, id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}
