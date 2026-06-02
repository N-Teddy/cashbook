use std::{fs, path::PathBuf, sync::Mutex};

use rusqlite::Connection;
use tauri::AppHandle;
use tauri::Manager;

use crate::error::DbError;

pub struct Db(pub Mutex<Connection>);

impl Db {
    pub fn open(app: &AppHandle) -> Result<Self, DbError> {
        let db_path = db_path(app)?;
        if let Some(parent) = db_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let conn = Connection::open(db_path)?;
        conn.execute_batch(
            r#"
            PRAGMA foreign_keys = ON;
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            "#,
        )?;

        migrate(&conn)?;
        seed_defaults(&conn)?;

        Ok(Self(Mutex::new(conn)))
    }
}

pub fn db_path(app: &AppHandle) -> Result<PathBuf, DbError> {
    let dir = app.path().app_data_dir()?;
    Ok(dir.join("expense_tracker.sqlite3"))
}

fn migrate(conn: &Connection) -> Result<(), DbError> {
    let current: i64 = conn.query_row("PRAGMA user_version;", [], |row| row.get(0))?;

    // Migration 1
    if current < 1 {
        conn.execute_batch(include_str!("../../migrations/0001_init.sql"))?;
        conn.execute("PRAGMA user_version = 1;", [])?;
    }

    // Migration 2
    if current < 2 {
        conn.execute_batch(include_str!("../../migrations/0002_transfers.sql"))?;
        conn.execute("PRAGMA user_version = 2;", [])?;
    }

    // Migration 3
    if current < 3 {
        conn.execute_batch(include_str!("../../migrations/0003_settings.sql"))?;
        conn.execute("PRAGMA user_version = 3;", [])?;
    }

    Ok(())
}

fn seed_defaults(conn: &Connection) -> Result<(), DbError> {
    // Seed categories only if none exist.
    let count: i64 = conn.query_row(
        "SELECT COUNT(1) FROM categories WHERE deleted_at IS NULL;",
        [],
        |row| row.get(0),
    )?;

    if count > 0 {
        return Ok(());
    }

    // IDs are stable to avoid duplicates if seeding changes later.
    // (We can migrate/extend in a future seed version.)
    conn.execute_batch(
        r#"
        INSERT INTO categories (id, name, kind, parent_id, created_at, updated_at, deleted_at) VALUES
          ('cat_exp_food', 'Food', 'expense', NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL),
          ('cat_exp_transport', 'Transport', 'expense', NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL),
          ('cat_exp_bills', 'Bills', 'expense', NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL),
          ('cat_exp_rent', 'Rent', 'expense', NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL),
          ('cat_exp_health', 'Health', 'expense', NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL),
          ('cat_exp_entertainment', 'Entertainment', 'expense', NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL),
          ('cat_exp_shopping', 'Shopping', 'expense', NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL),
          ('cat_exp_other', 'Other', 'expense', NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL),

          ('cat_inc_salary', 'Salary', 'income', NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL),
          ('cat_inc_business', 'Business', 'income', NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL),
          ('cat_inc_gift', 'Gift', 'income', NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL),
          ('cat_inc_other', 'Other', 'income', NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL);
        "#,
    )?;

    Ok(())
}

