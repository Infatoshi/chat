// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod conversations;

use conversations::{Conversation, ConversationManager};
use tauri::{State, Manager};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn get_conversations_index(
    conversation_manager: State<'_, ConversationManager>,
) -> Result<Vec<String>, String> {
    conversation_manager
        .get_index()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_conversation(
    filename: &str,
    conversation_manager: State<'_, ConversationManager>,
) -> Result<Conversation, String> {
    conversation_manager
        .get_conversation(filename)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_conversation(
    filename: &str,
    content: serde_json::Value,
    conversation_manager: State<'_, ConversationManager>,
) -> Result<(), String> {
    conversation_manager
        .save_conversation(filename, content)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_conversation(
    filename: &str,
    conversation_manager: State<'_, ConversationManager>,
) -> Result<(), String> {
    conversation_manager
        .delete_conversation(filename)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn clear_all_conversations(
    conversation_manager: State<'_, ConversationManager>,
) -> Result<(), String> {
    conversation_manager
        .clear_all_conversations()
        .await
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let conversation_manager = ConversationManager::new(app.handle().clone());
            app.manage(conversation_manager);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_conversations_index,
            get_conversation,
            save_conversation,
            delete_conversation,
            clear_all_conversations,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
