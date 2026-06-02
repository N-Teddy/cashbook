use chrono::{Datelike, SecondsFormat, TimeZone, Utc};
use rusqlite::params;
use serde::Serialize;
use tauri::State;

use crate::db::Db;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrencyTotals {
    pub currency: String,
    pub income_minor: i64,
    pub expense_minor: i64,
    pub net_minor: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountTotals {
    pub account_id: String,
    pub account_name: String,
    pub currency: String,
    pub income_minor: i64,
    pub expense_minor: i64,
    pub net_minor: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryTotals {
    pub category_id: String,
    pub category_name: String,
    pub currency: String,
    pub expense_minor: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardMonthSummary {
    pub month: String, // YYYY-MM
    pub start: String,
    pub end: String,
    pub totals_by_currency: Vec<CurrencyTotals>,
    pub totals_by_account: Vec<AccountTotals>,
    pub top_expense_categories: Vec<CategoryTotals>,
}

fn month_range_utc(month: Option<String>) -> Result<(String, String, String), String> {
    let dt = if let Some(m) = month {
        // Expect YYYY-MM
        let parts: Vec<&str> = m.split('-').collect();
        if parts.len() != 2 {
            return Err("month must be YYYY-MM".to_string());
        }
        let year: i32 = parts[0].parse().map_err(|_| "invalid year".to_string())?;
        let mon: u32 = parts[1].parse().map_err(|_| "invalid month".to_string())?;
        if mon < 1 || mon > 12 {
            return Err("invalid month".to_string());
        }
        Utc.with_ymd_and_hms(year, mon, 1, 0, 0, 0)
            .single()
            .ok_or_else(|| "invalid month".to_string())?
    } else {
        let now = Utc::now();
        Utc.with_ymd_and_hms(now.year(), now.month(), 1, 0, 0, 0)
            .single()
            .ok_or_else(|| "invalid current month".to_string())?
    };

    let next = if dt.month() == 12 {
        Utc.with_ymd_and_hms(dt.year() + 1, 1, 1, 0, 0, 0)
            .single()
            .ok_or_else(|| "invalid next month".to_string())?
    } else {
        Utc.with_ymd_and_hms(dt.year(), dt.month() + 1, 1, 0, 0, 0)
            .single()
            .ok_or_else(|| "invalid next month".to_string())?
    };

    let month_str = format!("{:04}-{:02}", dt.year(), dt.month());
    let start = dt.to_rfc3339_opts(SecondsFormat::Millis, true);
    let end = next.to_rfc3339_opts(SecondsFormat::Millis, true);
    Ok((month_str, start, end))
}

#[tauri::command]
pub fn dashboard_month_summary(
    db: State<'_, Db>,
    month: Option<String>,
) -> Result<DashboardMonthSummary, String> {
    let (month_str, start, end) = month_range_utc(month)?;

    let conn = db.0.lock().map_err(|_| "db lock poisoned".to_string())?;

    // Totals by currency
    let mut totals_by_currency = Vec::new();
    {
        let mut stmt = conn
            .prepare(
                r#"
                SELECT
                  t.currency,
                  SUM(CASE WHEN t.type = 'income' THEN t.amount_minor ELSE 0 END) AS income_minor,
                  SUM(CASE WHEN t.type = 'expense' THEN t.amount_minor ELSE 0 END) AS expense_minor
                FROM transactions t
                WHERE t.deleted_at IS NULL
                  AND t.type IN ('income','expense')
                  AND t.occurred_at >= ?1 AND t.occurred_at < ?2
                GROUP BY t.currency
                ORDER BY t.currency ASC;
                "#,
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(params![start, end], |row| {
                let currency: String = row.get(0)?;
                let income: i64 = row.get(1)?;
                let expense: i64 = row.get(2)?;
                Ok(CurrencyTotals {
                    currency,
                    income_minor: income,
                    expense_minor: expense,
                    net_minor: income - expense,
                })
            })
            .map_err(|e| e.to_string())?;

        for r in rows {
            totals_by_currency.push(r.map_err(|e| e.to_string())?);
        }
    }

    // Totals by account (income/expense only)
    let mut totals_by_account = Vec::new();
    {
        let mut stmt = conn
            .prepare(
                r#"
                SELECT
                  a.id,
                  a.name,
                  a.currency,
                  SUM(CASE WHEN t.type = 'income' THEN t.amount_minor ELSE 0 END) AS income_minor,
                  SUM(CASE WHEN t.type = 'expense' THEN t.amount_minor ELSE 0 END) AS expense_minor
                FROM accounts a
                LEFT JOIN transactions t
                  ON t.account_id = a.id
                 AND t.deleted_at IS NULL
                 AND t.type IN ('income','expense')
                 AND t.occurred_at >= ?1 AND t.occurred_at < ?2
                ORDER BY a.created_at ASC;
                "#,
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(params![start, end], |row| {
                let income: i64 = row.get(3)?;
                let expense: i64 = row.get(4)?;
                Ok(AccountTotals {
                    account_id: row.get(0)?,
                    account_name: row.get(1)?,
                    currency: row.get(2)?,
                    income_minor: income,
                    expense_minor: expense,
                    net_minor: income - expense,
                })
            })
            .map_err(|e| e.to_string())?;

        for r in rows {
            totals_by_account.push(r.map_err(|e| e.to_string())?);
        }
    }

    // Top expense categories (grouped by category+currency)
    let mut top_expense_categories = Vec::new();
    {
        let mut stmt = conn
            .prepare(
                r#"
                SELECT
                  c.id,
                  c.name,
                  t.currency,
                  SUM(t.amount_minor) AS expense_minor
                FROM transactions t
                JOIN categories c ON c.id = t.category_id
                WHERE t.deleted_at IS NULL
                  AND t.type = 'expense'
                  AND t.occurred_at >= ?1 AND t.occurred_at < ?2
                GROUP BY c.id, c.name, t.currency
                ORDER BY expense_minor DESC
                LIMIT 8;
                "#,
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(params![start, end], |row| {
                Ok(CategoryTotals {
                    category_id: row.get(0)?,
                    category_name: row.get(1)?,
                    currency: row.get(2)?,
                    expense_minor: row.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?;

        for r in rows {
            top_expense_categories.push(r.map_err(|e| e.to_string())?);
        }
    }

    Ok(DashboardMonthSummary {
        month: month_str,
        start,
        end,
        totals_by_currency,
        totals_by_account,
        top_expense_categories,
    })
}
