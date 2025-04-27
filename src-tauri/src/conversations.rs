use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, thiserror::Error)]
pub enum ConversationError {
    #[error("Failed to read conversation: {0}")]
    ReadError(String),
    #[error("Failed to write conversation: {0}")]
    WriteError(String),
    #[error("Failed to delete conversation: {0}")]
    DeleteError(String),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Conversation {
    pub filename: String,
    pub content: serde_json::Value,
}

pub struct ConversationManager {
    app: AppHandle,
    conversations_dir: PathBuf,
}

impl ConversationManager {
    pub fn new(app: AppHandle) -> Self {
        let app_dir = app
            .path()
            .app_data_dir()
            .expect("Failed to get app data directory");
        let conversations_dir = app_dir.join("chat_conversations");
        
        // Ensure the conversations directory exists
        std::fs::create_dir_all(&conversations_dir).expect("Failed to create conversations directory");
        
        // Ensure index.json exists
        let index_path = conversations_dir.join("index.json");
        if !index_path.exists() {
            std::fs::write(&index_path, "[]").expect("Failed to create index.json");
        }
        
        Self {
            app,
            conversations_dir,
        }
    }

    pub async fn get_index(&self) -> Result<Vec<String>> {
        let index_path = self.conversations_dir.join("index.json");
        let content = std::fs::read_to_string(index_path)?;
        let mut index: Vec<String> = serde_json::from_str(&content)?;
        // Sort by filename (which contains the date) in descending order
        index.sort_by(|a, b| b.cmp(a));
        Ok(index)
    }

    pub async fn get_conversation(&self, filename: &str) -> Result<Conversation> {
        let file_path = self.conversations_dir.join(filename);
        let content = std::fs::read_to_string(file_path)?;
        let content: serde_json::Value = serde_json::from_str(&content)?;
        Ok(Conversation {
            filename: filename.to_string(),
            content,
        })
    }

    pub async fn save_conversation(&self, filename: &str, content: serde_json::Value) -> Result<()> {
        let file_path = self.conversations_dir.join(filename);
        std::fs::write(&file_path, serde_json::to_string_pretty(&content)?)?;

        // Update index
        let index_path = self.conversations_dir.join("index.json");
        let index_content = std::fs::read_to_string(&index_path)?;
        let mut index: Vec<String> = serde_json::from_str(&index_content)?;
        
        if !index.contains(&filename.to_string()) {
            index.push(filename.to_string());
            std::fs::write(index_path, serde_json::to_string_pretty(&index)?)?;
        }
        
        Ok(())
    }

    pub async fn delete_conversation(&self, filename: &str) -> Result<()> {
        let file_path = self.conversations_dir.join(filename);
        if file_path.exists() {
            std::fs::remove_file(&file_path)?;
        }

        // Update index
        let index_path = self.conversations_dir.join("index.json");
        let index_content = std::fs::read_to_string(&index_path)?;
        let mut index: Vec<String> = serde_json::from_str(&index_content)?;
        index.retain(|f| f != filename);
        std::fs::write(index_path, serde_json::to_string_pretty(&index)?)?;
        
        Ok(())
    }

    pub async fn clear_all_conversations(&self) -> Result<()> {
        let index = self.get_index().await?;
        
        // Delete all conversation files
        for filename in &index {
            let _ = self.delete_conversation(filename).await;
        }

        // Reset index
        let index_path = self.conversations_dir.join("index.json");
        std::fs::write(index_path, "[]")?;
        
        Ok(())
    }
} 