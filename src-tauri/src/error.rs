use thiserror::Error;

#[derive(Debug, Error)]
pub enum DbError {
    #[error("filesystem error: {0}")]
    Fs(#[from] std::io::Error),

    #[error("tauri path error: {0}")]
    TauriPath(#[from] tauri::Error),

    #[error("sqlite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
}

