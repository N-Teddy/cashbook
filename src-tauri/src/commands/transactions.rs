use chrono::{SecondsFormat, Utc};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::db::Db;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionRow {
    pub id: String,
    pub r#type: String,
    pub amount_minor: i64,
    pub currency: String,
    pub account_id: Option<String>,
    pub account_name: Option<String>,
    pub from_account_id: Option<String>,
    pub from_account_name: Option<String>,
    pub to_account_id: Option<String>,
    pub to_account_name: Option<String>,
    pub category_id: Option<String>,
    pub category_name: Option<String>,
    pub merchant: Option<String>,
    pub note: Option<String>,
    pub occurred_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpenseIncomeCreateInput {
    pub r#type: String, // income | expense
    pub amount_minor: i64,
    pub account_id: String,
    pub category_id: Option<String>,
    pub merchant: Option<String>,
    pub note: Option<String>,
    pub occurred_at: String, // RFC3339
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferCreateInput {
    pub amount_minor: i64,
    pub from_account_id: String,
    pub to_account_id: String,
    pub note: Option<String>,
    pub occurred_at: String, // RFC3339
}

fn now_rfc3339() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn account_currency(conn: &rusqlite::Connection, account_id: &str) -> Result<String, String> {
    conn.query_row(
        "SELECT currency FROM accounts WHERE id = ?1 AND deleted_at IS NULL;",
        [account_id],
        |row| row.get::<_, String>(0),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn transaction_create_expense_income(
    db: State<'_, Db>,
    input: ExpenseIncomeCreateInput,
) -> Result<String, String> {
    if input.r#type != "expense" && input.r#type != "income" {
        return Err("type must be 'expense' or 'income'".to_string());
    }
    if input.amount_minor <= 0 {
        return Err("amount must be > 0".to_string());
    }
    if input.account_id.trim().is_empty() {
        return Err("accountId is required".to_string());
    }

    let conn = db.0.lock().map_err(|_| "db lock poisoned".to_string())?;
    let currency = account_currency(&conn, &input.account_id)?;

    let id = Uuid::new_v4().to_string();
    let now = now_rfc3339();
    conn.execute(
        r#"
        INSERT INTO transactions (
          id, type, amount_minor, currency,
          account_id, category_id, merchant, note,
          occurred_at, created_at, updated_at, deleted_at,
          from_account_id, to_account_id
        )
        VALUES (
          ?1, ?2, ?3, ?4,
          ?5, ?6, ?7, ?8,
          ?9, ?10, ?11, NULL,
          NULL, NULL
        );
        "#,
        params![
            id,
            input.r#type,
            input.amount_minor,
            currency,
            input.account_id,
            input.category_id,
            input.merchant,
            input.note,
            input.occurred_at,
            now,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(id)
}

#[tauri::command]
pub fn transaction_create_transfer(
    db: State<'_, Db>,
    input: TransferCreateInput,
) -> Result<String, String> {
    if input.amount_minor <= 0 {
        return Err("amount must be > 0".to_string());
    }
    if input.from_account_id.trim().is_empty() || input.to_account_id.trim().is_empty() {
        return Err("fromAccountId and toAccountId are required".to_string());
    }
    if input.from_account_id == input.to_account_id {
        return Err("from and to accounts must be different".to_string());
    }

    let conn = db.0.lock().map_err(|_| "db lock poisoned".to_string())?;
    let from_currency = account_currency(&conn, &input.from_account_id)?;
    let to_currency = account_currency(&conn, &input.to_account_id)?;
    if from_currency != to_currency {
        return Err("transfer requires same currency accounts (v1)".to_string());
    }

    let id = Uuid::new_v4().to_string();
    let now = now_rfc3339();

    // For compatibility with v1 schema (account_id is NOT NULL), store account_id = from_account_id.
    conn.execute(
        r#"
        INSERT INTO transactions (
          id, type, amount_minor, currency,
          account_id, category_id, merchant, note,
          occurred_at, created_at, updated_at, deleted_at,
          from_account_id, to_account_id
        )
        VALUES (
          ?1, 'transfer', ?2, ?3,
          ?4, NULL, NULL, ?5,
          ?6, ?7, ?8, NULL,
          ?9, ?10
        );
        "#,
        params![
            id,
            input.amount_minor,
            from_currency,
            input.from_account_id,
            input.note,
            input.occurred_at,
            now,
            now,
            input.from_account_id,
            input.to_account_id
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(id)
}

#[tauri::command]
pub fn transaction_list(
    db: State<'_, Db>,
    limit: Option<u32>,
    account_id: Option<String>,
) -> Result<Vec<TransactionRow>, String> {
    let limit = limit.unwrap_or(200).min(1000);
    let conn = db.0.lock().map_err(|_| "db lock poisoned".to_string())?;

    let mut out = Vec::new();

    if let Some(aid) = account_id {
        let mut stmt = conn
            .prepare(
                r#"
                SELECT
                  t.id, t.type, t.amount_minor, t.currency,
                  t.account_id,
                  a.name,
                  t.from_account_id,
                  af.name,
                  t.to_account_id,
                  at.name,
                  t.category_id,
                  c.name,
                  t.merchant, t.note, t.occurred_at
                FROM transactions t
                LEFT JOIN accounts a ON a.id = t.account_id
                LEFT JOIN accounts af ON af.id = t.from_account_id
                LEFT JOIN accounts at ON at.id = t.to_account_id
                LEFT JOIN categories c ON c.id = t.category_id
                WHERE t.deleted_at IS NULL AND t.account_id = ?1
                ORDER BY t.occurred_at DESC
                LIMIT ?2;
                "#,
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(params![aid, limit], |row| {
                Ok(TransactionRow {
                    id: row.get(0)?,
                    r#type: row.get(1)?,
                    amount_minor: row.get(2)?,
                    currency: row.get(3)?,
                    account_id: row.get(4)?,
                    account_name: row.get(5)?,
                    from_account_id: row.get(6)?,
                    from_account_name: row.get(7)?,
                    to_account_id: row.get(8)?,
                    to_account_name: row.get(9)?,
                    category_id: row.get(10)?,
                    category_name: row.get(11)?,
                    merchant: row.get(12)?,
                    note: row.get(13)?,
                    occurred_at: row.get(14)?,
                })
            })
            .map_err(|e| e.to_string())?;

        for r in rows {
            out.push(r.map_err(|e| e.to_string())?);
        }
    } else {
        let mut stmt = conn
            .prepare(
                r#"
                SELECT
                  t.id, t.type, t.amount_minor, t.currency,
                  t.account_id,
                  a.name,
                  t.from_account_id,
                  af.name,
                  t.to_account_id,
                  at.name,
                  t.category_id,
                  c.name,
                  t.merchant, t.note, t.occurred_at
                FROM transactions t
                LEFT JOIN accounts a ON a.id = t.account_id
                LEFT JOIN accounts af ON af.id = t.from_account_id
                LEFT JOIN accounts at ON at.id = t.to_account_id
                LEFT JOIN categories c ON c.id = t.category_id
                WHERE t.deleted_at IS NULL
                ORDER BY t.occurred_at DESC
                LIMIT ?1;
                "#,
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(params![limit], |row| {
                Ok(TransactionRow {
                    id: row.get(0)?,
                    r#type: row.get(1)?,
                    amount_minor: row.get(2)?,
                    currency: row.get(3)?,
                    account_id: row.get(4)?,
                    account_name: row.get(5)?,
                    from_account_id: row.get(6)?,
                    from_account_name: row.get(7)?,
                    to_account_id: row.get(8)?,
                    to_account_name: row.get(9)?,
                    category_id: row.get(10)?,
                    category_name: row.get(11)?,
                    merchant: row.get(12)?,
                    note: row.get(13)?,
                    occurred_at: row.get(14)?,
                })
            })
            .map_err(|e| e.to_string())?;

        for r in rows {
            out.push(r.map_err(|e| e.to_string())?);
        }
    }

    Ok(out)
}

