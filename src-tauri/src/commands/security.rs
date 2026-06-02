use chrono::{SecondsFormat, Utc};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::State;

use crate::db::Db;

const KEY_LOCK_ENABLED: &str = "lock_enabled";
const KEY_BIOMETRIC_ENABLED: &str = "biometric_enabled";
const KEY_PATTERN_HASH: &str = "pattern_hash_v1";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecurityState {
    pub lock_enabled: bool,
    pub biometric_enabled: bool,
    pub has_pattern: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetPatternInput {
    pub pattern: String, // normalized string like "0-1-2-5"
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyPatternInput {
    pub pattern: String,
}

fn now_rfc3339() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn get_setting(conn: &rusqlite::Connection, key: &str) -> Result<Option<String>, String> {
    conn.query_row(
        "SELECT value FROM app_settings WHERE key = ?1 LIMIT 1;",
        [key],
        |row| row.get::<_, String>(0),
    )
    .optional()
    .map_err(|e| e.to_string())
}

fn set_setting(conn: &rusqlite::Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        r#"
        INSERT INTO app_settings (key, value) VALUES (?1, ?2)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value;
        "#,
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn parse_bool(s: Option<String>) -> bool {
    matches!(s.as_deref(), Some("1") | Some("true") | Some("TRUE") | Some("yes") | Some("YES"))
}

fn hash_pattern(pattern: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(pattern.as_bytes());
    let out = hasher.finalize();
    hex::encode(out)
}

fn validate_pattern_string(p: &str) -> Result<(), String> {
    // Expect "n-n-n..." where n is 0..8 unique, length >= 4
    let parts: Vec<&str> = p.split('-').filter(|s| !s.is_empty()).collect();
    if parts.len() < 4 {
        return Err("pattern must connect at least 4 dots".to_string());
    }
    let mut seen = std::collections::HashSet::new();
    for s in parts {
        let n: u8 = s.parse().map_err(|_| "invalid pattern".to_string())?;
        if n > 8 {
            return Err("invalid pattern".to_string());
        }
        if !seen.insert(n) {
            return Err("invalid pattern (repeated dot)".to_string());
        }
    }
    Ok(())
}

#[tauri::command]
pub fn security_state(db: State<'_, Db>) -> Result<SecurityState, String> {
    let conn = db.0.lock().map_err(|_| "db lock poisoned".to_string())?;
    let lock_enabled = parse_bool(get_setting(&conn, KEY_LOCK_ENABLED)?);
    let biometric_enabled = parse_bool(get_setting(&conn, KEY_BIOMETRIC_ENABLED)?);
    let has_pattern = get_setting(&conn, KEY_PATTERN_HASH)?.is_some();
    Ok(SecurityState {
        lock_enabled,
        biometric_enabled,
        has_pattern,
    })
}

#[tauri::command]
pub fn security_set_lock_enabled(db: State<'_, Db>, enabled: bool) -> Result<(), String> {
    let conn = db.0.lock().map_err(|_| "db lock poisoned".to_string())?;
    set_setting(&conn, KEY_LOCK_ENABLED, if enabled { "1" } else { "0" })?;
    Ok(())
}

#[tauri::command]
pub fn security_set_biometric_enabled(db: State<'_, Db>, enabled: bool) -> Result<(), String> {
    let conn = db.0.lock().map_err(|_| "db lock poisoned".to_string())?;
    set_setting(
        &conn,
        KEY_BIOMETRIC_ENABLED,
        if enabled { "1" } else { "0" },
    )?;
    Ok(())
}

#[tauri::command]
pub fn security_set_pattern(db: State<'_, Db>, input: SetPatternInput) -> Result<(), String> {
    validate_pattern_string(&input.pattern)?;
    let conn = db.0.lock().map_err(|_| "db lock poisoned".to_string())?;
    let h = hash_pattern(&input.pattern);
    set_setting(&conn, KEY_PATTERN_HASH, &h)?;

    // Enabling pattern implies lock enabled.
    set_setting(&conn, KEY_LOCK_ENABLED, "1")?;
    // If biometric isn't set, default it on (user can disable).
    if get_setting(&conn, KEY_BIOMETRIC_ENABLED)?.is_none() {
        set_setting(&conn, KEY_BIOMETRIC_ENABLED, "1")?;
    }

    // Track last update time (useful later)
    set_setting(&conn, "pattern_updated_at", &now_rfc3339())?;
    Ok(())
}

#[tauri::command]
pub fn security_verify_pattern(db: State<'_, Db>, input: VerifyPatternInput) -> Result<bool, String> {
    validate_pattern_string(&input.pattern)?;
    let conn = db.0.lock().map_err(|_| "db lock poisoned".to_string())?;
    let stored = get_setting(&conn, KEY_PATTERN_HASH)?;
    let Some(stored_hash) = stored else {
        return Err("no pattern set".to_string());
    };
    Ok(hash_pattern(&input.pattern) == stored_hash)
}

