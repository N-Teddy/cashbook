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

    Ok(())
}

