use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::commands::transactions::{account_currency, insert_transaction, now_rfc3339};
use crate::db::Db;

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DebtRow {
    pub id: String,
    pub contact_id: Option<String>,
    pub kind: String,                     // "owed_by_me" | "owed_to_me"
    pub counterparty: String,             // contact name (denormalised for display)
    pub principal_minor: i64,
    pub currency: String,
    pub account_id: Option<String>,
    pub account_name: Option<String>,
    pub opened_at: String,
    pub due_at: Option<String>,
    pub status: String,                   // "open" | "closed"
    pub note: Option<String>,
    pub outstanding_balance_minor: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DebtCreateInput {
    pub contact_id: String,               // required
    pub kind: String,
    pub principal_minor: i64,
    pub currency: Option<String>,         // defaults to "XAF"
    pub account_id: Option<String>,       // which account money left/entered
    pub due_at: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DebtPaymentRow {
    pub id: String,
    pub debt_id: String,
    pub amount_minor: i64,
    pub account_id: Option<String>,
    pub account_name: Option<String>,
    pub occurred_at: String,
    pub note: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DebtPaymentAddInput {
    pub debt_id: String,
    pub amount_minor: i64,
    pub account_id: Option<String>,
    pub note: Option<String>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn outstanding_balance(conn: &rusqlite::Connection, debt_id: &str) -> Result<i64, String> {
    let principal: i64 = conn
        .query_row(
            "SELECT principal_minor FROM debts WHERE id = ?1 AND deleted_at IS NULL;",
            [debt_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let paid: i64 = conn
        .query_row(
            r#"
            SELECT COALESCE(SUM(amount_minor), 0)
            FROM debt_payments
            WHERE debt_id = ?1 AND deleted_at IS NULL;
            "#,
            [debt_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    Ok(principal - paid)
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// List all non-deleted debts, optionally filtered by contact.
#[tauri::command]
pub fn debt_list(
    db: State<'_, Db>,
    contact_id: Option<String>,
) -> Result<Vec<DebtRow>, String> {
    let conn = db.0.lock().map_err(|_| "db lock poisoned".to_string())?;

    let sql = r#"
        SELECT
          d.id,
          d.contact_id,
          d.kind,
          COALESCE(c.name, d.counterparty) AS counterparty,
          d.principal_minor,
          d.currency,
          d.account_id,
          a.name AS account_name,
          d.opened_at,
          d.due_at,
          d.status,
          d.note,
          d.created_at,
          d.updated_at,
          d.principal_minor - COALESCE(
            (SELECT SUM(p.amount_minor)
             FROM debt_payments p
             WHERE p.debt_id = d.id AND p.deleted_at IS NULL),
            0
          ) AS outstanding_balance_minor
        FROM debts d
        LEFT JOIN contacts c ON c.id = d.contact_id
        LEFT JOIN accounts a ON a.id = d.account_id
        WHERE d.deleted_at IS NULL
    "#;

    let mut out = Vec::new();

    macro_rules! map_row {
        ($row:ident) => {
            DebtRow {
                id: $row.get(0)?,
                contact_id: $row.get(1)?,
                kind: $row.get(2)?,
                counterparty: $row.get(3)?,
                principal_minor: $row.get(4)?,
                currency: $row.get(5)?,
                account_id: $row.get(6)?,
                account_name: $row.get(7)?,
                opened_at: $row.get(8)?,
                due_at: $row.get(9)?,
                status: $row.get(10)?,
                note: $row.get(11)?,
                created_at: $row.get(12)?,
                updated_at: $row.get(13)?,
                outstanding_balance_minor: $row.get(14)?,
            }
        };
    }

    if let Some(cid) = contact_id {
        let full_sql = format!("{} AND d.contact_id = ?1 ORDER BY d.opened_at DESC;", sql);
        let mut stmt = conn.prepare(&full_sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![cid], |row| Ok(map_row!(row)))
            .map_err(|e| e.to_string())?;
        for r in rows {
            out.push(r.map_err(|e| e.to_string())?);
        }
    } else {
        let full_sql = format!("{} ORDER BY d.opened_at DESC;", sql);
        let mut stmt = conn.prepare(&full_sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| Ok(map_row!(row)))
            .map_err(|e| e.to_string())?;
        for r in rows {
            out.push(r.map_err(|e| e.to_string())?);
        }
    }

    Ok(out)
}

/// Create a new debt attached to a contact.
#[tauri::command]
pub fn debt_create(db: State<'_, Db>, input: DebtCreateInput) -> Result<DebtRow, String> {
    let contact_id = input.contact_id.trim().to_string();
    if contact_id.is_empty() {
        return Err("contactId is required".to_string());
    }

    let kind = input.kind.trim().to_string();
    if kind != "owed_by_me" && kind != "owed_to_me" {
        return Err("kind must be 'owed_by_me' or 'owed_to_me'".to_string());
    }

    if input.principal_minor <= 0 {
        return Err("amount must be > 0".to_string());
    }

    let currency = input
        .currency
        .unwrap_or_else(|| "XAF".to_string())
        .trim()
        .to_string();
    let currency = if currency.is_empty() {
        "XAF".to_string()
    } else {
        currency
    };

    let id = Uuid::new_v4().to_string();
    let now = now_rfc3339();

    let conn = db.0.lock().map_err(|_| "db lock poisoned".to_string())?;

    // Verify contact exists
    let contact_name: Option<String> = conn
        .query_row(
            "SELECT name FROM contacts WHERE id = ?1 AND deleted_at IS NULL;",
            [contact_id.clone()],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let contact_name = contact_name.ok_or_else(|| "contact not found".to_string())?;

    // Resolve account name if provided
    let account_name: Option<String> = if let Some(ref aid) = input.account_id {
        conn.query_row(
            "SELECT name FROM accounts WHERE id = ?1 AND deleted_at IS NULL;",
            [aid.clone()],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?
    } else {
        None
    };

    // Derive the currency from the linked account if possible
    let currency = if let Some(ref aid) = input.account_id {
        account_currency(&conn, aid).unwrap_or(currency)
    } else {
        currency
    };

    // Write a transaction row for this debt creation:
    // owed_by_me (I borrowed) → money entered my account → type "borrow"
    // owed_to_me (I lent)     → money left my account   → type "lend"
    let tx_type = if kind == "owed_by_me" { "borrow" } else { "lend" };
    let tx_id = Uuid::new_v4().to_string();

    if input.account_id.is_some() {
        insert_transaction(
            &conn,
            &tx_id,
            tx_type,
            input.principal_minor,
            &currency,
            input.account_id.as_deref(),
            None, None,
            None,
            Some(&contact_id),
            None,
            input.note.as_deref(),
            &now,
            &now,
        )?;
    }

    let transaction_id = if input.account_id.is_some() {
        Some(tx_id)
    } else {
        None
    };

    conn.execute(
        r#"
        INSERT INTO debts (
          id, contact_id, kind, counterparty, principal_minor, currency,
          account_id, opened_at, due_at, status, note, transaction_id,
          created_at, updated_at, deleted_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'open', ?10, ?11, ?12, ?12, NULL);
        "#,
        params![
            id,
            contact_id,
            kind,
            contact_name,
            input.principal_minor,
            currency,
            input.account_id,
            now,                // opened_at
            input.due_at,
            input.note,
            transaction_id,
            now,                // created_at / updated_at
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(DebtRow {
        id,
        contact_id: Some(contact_id),
        kind,
        counterparty: contact_name,
        principal_minor: input.principal_minor,
        currency,
        account_id: input.account_id.clone(),
        account_name,
        opened_at: now.clone(),
        due_at: input.due_at,
        status: "open".to_string(),
        note: input.note,
        outstanding_balance_minor: input.principal_minor,
        created_at: now.clone(),
        updated_at: now,
    })
}

/// Manually set a debt's status.
#[tauri::command]
pub fn debt_set_status(
    db: State<'_, Db>,
    debt_id: String,
    status: String,
) -> Result<(), String> {
    let id = debt_id.trim().to_string();
    if id.is_empty() {
        return Err("debtId is required".to_string());
    }
    let status = status.trim().to_string();
    if status != "open" && status != "closed" {
        return Err("status must be 'open' or 'closed'".to_string());
    }

    let conn = db.0.lock().map_err(|_| "db lock poisoned".to_string())?;
    let now = now_rfc3339();

    let changed = conn
        .execute(
            "UPDATE debts SET status = ?2, updated_at = ?3 WHERE id = ?1 AND deleted_at IS NULL;",
            params![id, status, now],
        )
        .map_err(|e| e.to_string())?;

    if changed == 0 {
        return Err("debt not found".to_string());
    }
    Ok(())
}

/// Soft-delete a debt and all its payments.
#[tauri::command]
pub fn debt_delete(db: State<'_, Db>, debt_id: String) -> Result<(), String> {
    let id = debt_id.trim().to_string();
    if id.is_empty() {
        return Err("debtId is required".to_string());
    }

    let conn = db.0.lock().map_err(|_| "db lock poisoned".to_string())?;
    let now = now_rfc3339();

    let exists: Option<String> = conn
        .query_row(
            "SELECT id FROM debts WHERE id = ?1 AND deleted_at IS NULL;",
            [id.clone()],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    if exists.is_none() {
        return Err("debt not found".to_string());
    }

    conn.execute(
        "UPDATE debt_payments SET deleted_at = ?1 WHERE debt_id = ?2 AND deleted_at IS NULL;",
        params![now, id],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE debts SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2;",
        params![now, id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Add a payment to a debt; auto-close when balance reaches zero.
#[tauri::command]
pub fn debt_payment_add(
    db: State<'_, Db>,
    input: DebtPaymentAddInput,
) -> Result<DebtPaymentRow, String> {
    if input.amount_minor <= 0 {
        return Err("payment amount must be > 0".to_string());
    }
    let debt_id = input.debt_id.trim().to_string();
    if debt_id.is_empty() {
        return Err("debtId is required".to_string());
    }

    let conn = db.0.lock().map_err(|_| "db lock poisoned".to_string())?;

    // Fetch debt to get kind and contact_id for the transaction
    let debt_info: Option<(String, Option<String>, String)> = conn
        .query_row(
            "SELECT kind, contact_id, currency FROM debts WHERE id = ?1 AND deleted_at IS NULL;",
            [debt_id.clone()],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let (debt_kind, contact_id, currency) = debt_info.ok_or_else(|| "debt not found".to_string())?;

    // Resolve account name
    let account_name: Option<String> = if let Some(ref aid) = input.account_id {
        conn.query_row(
            "SELECT name FROM accounts WHERE id = ?1 AND deleted_at IS NULL;",
            [aid.clone()],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?
    } else {
        None
    };

    let payment_id = Uuid::new_v4().to_string();
    let now = now_rfc3339();

    // Write a transaction row for this repayment:
    // owed_by_me (I borrowed, now repaying) → money leaves my account → type "expense" direction
    // owed_to_me (I lent, now collecting)   → money enters my account → type "income" direction
    // We use dedicated sub-types so Activity can label them clearly.
    let tx_type = if debt_kind == "owed_by_me" {
        "debt_repayment"   // I'm paying back what I borrowed
    } else {
        "debt_collection"  // I'm collecting what I lent
    };

    let tx_id = Uuid::new_v4().to_string();
    let repayment_currency = if let Some(ref aid) = input.account_id {
        account_currency(&conn, aid).unwrap_or(currency)
    } else {
        currency
    };

    insert_transaction(
        &conn,
        &tx_id,
        tx_type,
        input.amount_minor,
        &repayment_currency,
        input.account_id.as_deref(),
        None, None,
        None,
        contact_id.as_deref(),
        None,
        input.note.as_deref(),
        &now,
        &now,
    )?;

    conn.execute(
        r#"
        INSERT INTO debt_payments (
          id, debt_id, amount_minor, account_id, occurred_at, note, transaction_id,
          created_at, updated_at, deleted_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?5, ?5, NULL);
        "#,
        params![
            payment_id,
            debt_id,
            input.amount_minor,
            input.account_id,
            now,
            input.note,
            tx_id,
        ],
    )
    .map_err(|e| e.to_string())?;

    let balance = outstanding_balance(&conn, &debt_id)?;
    if balance <= 0 {
        conn.execute(
            "UPDATE debts SET status = 'closed', updated_at = ?1 WHERE id = ?2;",
            params![now, debt_id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(DebtPaymentRow {
        id: payment_id,
        debt_id,
        amount_minor: input.amount_minor,
        account_id: input.account_id,
        account_name,
        occurred_at: now.clone(),
        note: input.note,
        created_at: now,
    })
}

/// List all non-deleted payments for a debt.
#[tauri::command]
pub fn debt_payment_list(
    db: State<'_, Db>,
    debt_id: String,
) -> Result<Vec<DebtPaymentRow>, String> {
    let id = debt_id.trim().to_string();
    if id.is_empty() {
        return Ok(vec![]);
    }

    let conn = db.0.lock().map_err(|_| "db lock poisoned".to_string())?;

    let mut stmt = conn
        .prepare(
            r#"
            SELECT
              p.id, p.debt_id, p.amount_minor,
              p.account_id, a.name,
              p.occurred_at, p.note, p.created_at
            FROM debt_payments p
            LEFT JOIN accounts a ON a.id = p.account_id
            WHERE p.debt_id = ?1 AND p.deleted_at IS NULL
            ORDER BY p.occurred_at DESC;
            "#,
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([id], |row| {
            Ok(DebtPaymentRow {
                id: row.get(0)?,
                debt_id: row.get(1)?,
                amount_minor: row.get(2)?,
                account_id: row.get(3)?,
                account_name: row.get(4)?,
                occurred_at: row.get(5)?,
                note: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}
