use chrono::{SecondsFormat, Utc};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::db::Db;

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionRow {
    pub id: String,
    pub r#type: String,
    pub amount_minor: i64,
    pub currency: String,
    // Regular expense/income account
    pub account_id: Option<String>,
    pub account_name: Option<String>,
    // Transfer from/to
    pub from_account_id: Option<String>,
    pub from_account_name: Option<String>,
    pub to_account_id: Option<String>,
    pub to_account_name: Option<String>,
    // Category (expense/income)
    pub category_id: Option<String>,
    pub category_name: Option<String>,
    // Contact (borrow/lend/give/receive_gift/repayment)
    pub contact_id: Option<String>,
    pub contact_name: Option<String>,
    // Misc
    pub merchant: Option<String>,
    pub note: Option<String>,
    pub occurred_at: String,
}

/// Used for expense / income
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpenseIncomeCreateInput {
    pub r#type: String, // expense | income
    pub amount_minor: i64,
    pub account_id: String,
    pub category_id: Option<String>,
    pub contact_id: Option<String>, // optional — link to a known person
    pub merchant: Option<String>,
    pub note: Option<String>,
    pub occurred_at: String,
}

/// Used for account→account transfer
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferCreateInput {
    pub amount_minor: i64,
    pub from_account_id: String,
    pub to_account_id: String,
    pub note: Option<String>,
    pub occurred_at: String,
}

/// Used for give / receive_gift — money with no repayment obligation
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GiveReceiveCreateInput {
    pub r#type: String, // give | receive_gift
    pub amount_minor: i64,
    pub account_id: String,        // where money leaves / enters
    pub contact_id: Option<String>, // optional — link to a known person
    pub note: Option<String>,
    pub occurred_at: String,
}

/// Used for lend / borrow — money with repayment obligation (informal, not a formal debt)
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LendBorrowCreateInput {
    pub r#type: String, // lend | borrow
    pub amount_minor: i64,
    pub account_id: String,        // where money leaves / enters
    pub contact_id: Option<String>, // optional — link to a known person
    pub note: Option<String>,
    pub occurred_at: String,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

pub fn now_rfc3339() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

pub fn account_currency(conn: &rusqlite::Connection, account_id: &str) -> Result<String, String> {
    conn.query_row(
        "SELECT currency FROM accounts WHERE id = ?1 AND deleted_at IS NULL;",
        [account_id],
        |row| row.get::<_, String>(0),
    )
    .map_err(|e| e.to_string())
}

/// Insert a transaction row and return its id. Caller holds the lock.
pub fn insert_transaction(
    conn: &rusqlite::Connection,
    id: &str,
    tx_type: &str,
    amount_minor: i64,
    currency: &str,
    account_id: Option<&str>,
    from_account_id: Option<&str>,
    to_account_id: Option<&str>,
    category_id: Option<&str>,
    contact_id: Option<&str>,
    merchant: Option<&str>,
    note: Option<&str>,
    occurred_at: &str,
    now: &str,
) -> Result<(), String> {
    conn.execute(
        r#"
        INSERT INTO transactions (
          id, type, amount_minor, currency,
          account_id, from_account_id, to_account_id,
          category_id, contact_id, merchant, note,
          occurred_at, created_at, updated_at, deleted_at
        )
        VALUES (
          ?1, ?2, ?3, ?4,
          ?5, ?6, ?7,
          ?8, ?9, ?10, ?11,
          ?12, ?13, ?13, NULL
        );
        "#,
        params![
            id, tx_type, amount_minor, currency,
            account_id, from_account_id, to_account_id,
            category_id, contact_id, merchant, note,
            occurred_at, now,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

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

    insert_transaction(
        &conn,
        &id,
        &input.r#type,
        input.amount_minor,
        &currency,
        Some(&input.account_id),
        None, None,
        input.category_id.as_deref(),
        input.contact_id.as_deref(),
        input.merchant.as_deref(),
        input.note.as_deref(),
        &input.occurred_at,
        &now,
    )?;

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

    insert_transaction(
        &conn,
        &id,
        "transfer",
        input.amount_minor,
        &from_currency,
        Some(&input.from_account_id), // keep account_id = from for compatibility
        Some(&input.from_account_id),
        Some(&input.to_account_id),
        None, None, None,
        input.note.as_deref(),
        &input.occurred_at,
        &now,
    )?;

    Ok(id)
}

#[tauri::command]
pub fn transaction_create_give_receive(
    db: State<'_, Db>,
    input: GiveReceiveCreateInput,
) -> Result<String, String> {
    if input.r#type != "give" && input.r#type != "receive_gift" {
        return Err("type must be 'give' or 'receive_gift'".to_string());
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

    insert_transaction(
        &conn,
        &id,
        &input.r#type,
        input.amount_minor,
        &currency,
        Some(&input.account_id),
        None, None,
        None, // no category
        input.contact_id.as_deref(),
        None, // no merchant
        input.note.as_deref(),
        &input.occurred_at,
        &now,
    )?;

    Ok(id)
}

#[tauri::command]
pub fn transaction_create_lend_borrow(
    db: State<'_, Db>,
    input: LendBorrowCreateInput,
) -> Result<String, String> {
    if input.r#type != "lend" && input.r#type != "borrow" {
        return Err("type must be 'lend' or 'borrow'".to_string());
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

    insert_transaction(
        &conn,
        &id,
        &input.r#type,
        input.amount_minor,
        &currency,
        Some(&input.account_id),
        None, None,
        None, // no category
        input.contact_id.as_deref(),
        None, // no merchant
        input.note.as_deref(),
        &input.occurred_at,
        &now,
    )?;

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

    let base = r#"
        SELECT
          t.id, t.type, t.amount_minor, t.currency,
          t.account_id,   a.name,
          t.from_account_id, af.name,
          t.to_account_id,   at2.name,
          t.category_id,  c.name,
          t.contact_id,   co.name,
          t.merchant, t.note, t.occurred_at
        FROM transactions t
        LEFT JOIN accounts a   ON a.id  = t.account_id
        LEFT JOIN accounts af  ON af.id = t.from_account_id
        LEFT JOIN accounts at2 ON at2.id= t.to_account_id
        LEFT JOIN categories c ON c.id  = t.category_id
        LEFT JOIN contacts co  ON co.id = t.contact_id
        WHERE t.deleted_at IS NULL
    "#;

    macro_rules! map_row {
        ($row:expr) => {
            TransactionRow {
                id:                $row.get(0)?,
                r#type:            $row.get(1)?,
                amount_minor:      $row.get(2)?,
                currency:          $row.get(3)?,
                account_id:        $row.get(4)?,
                account_name:      $row.get(5)?,
                from_account_id:   $row.get(6)?,
                from_account_name: $row.get(7)?,
                to_account_id:     $row.get(8)?,
                to_account_name:   $row.get(9)?,
                category_id:       $row.get(10)?,
                category_name:     $row.get(11)?,
                contact_id:        $row.get(12)?,
                contact_name:      $row.get(13)?,
                merchant:          $row.get(14)?,
                note:              $row.get(15)?,
                occurred_at:       $row.get(16)?,
            }
        };
    }

    let mut out = Vec::new();

    if let Some(aid) = account_id {
        let sql = format!(
            "{} AND (t.account_id = ?1 OR t.from_account_id = ?1 OR t.to_account_id = ?1) ORDER BY t.occurred_at DESC LIMIT ?2;",
            base
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![aid, limit], |row| Ok(map_row!(row)))
            .map_err(|e| e.to_string())?;
        for r in rows {
            out.push(r.map_err(|e| e.to_string())?);
        }
    } else {
        let sql = format!("{} ORDER BY t.occurred_at DESC LIMIT ?1;", base);
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![limit], |row| Ok(map_row!(row)))
            .map_err(|e| e.to_string())?;
        for r in rows {
            out.push(r.map_err(|e| e.to_string())?);
        }
    }

    Ok(out)
}
