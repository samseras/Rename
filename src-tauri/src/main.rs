// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::fs;

#[derive(Serialize)]
struct Dimensions {
    width: usize,
    height: usize,
}

#[derive(Serialize)]
struct FileInfo {
    name: String,
    path: String,
    #[serde(rename = "isDirectory")]
    is_directory: bool,
    dimensions: Option<Dimensions>,
    #[serde(rename = "fileSizeStr")]
    file_size_str: String,
}

#[tauri::command]
fn read_directory(dir_path: String) -> Result<Vec<FileInfo>, String> {
    let mut result = Vec::new();
    let entries = fs::read_dir(&dir_path).map_err(|e| e.to_string())?;

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            let metadata = entry.metadata().map_err(|e| e.to_string())?;
            let is_directory = metadata.is_dir();

            if is_directory {
                continue;
            }

            let name = entry.file_name().to_string_lossy().to_string();
            let size_in_bytes = metadata.len();
            let file_size_str = if size_in_bytes < 1024 * 1024 {
                format!("{:.1}KB", size_in_bytes as f64 / 1024.0)
            } else {
                format!("{:.2}MB", size_in_bytes as f64 / (1024.0 * 1024.0))
            };

            let mut dimensions = None;
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
            if ["jpg", "jpeg", "png", "gif", "webp", "bmp"].contains(&ext.as_str()) {
                if let Ok(dim) = imagesize::size(&path) {
                    dimensions = Some(Dimensions {
                        width: dim.width,
                        height: dim.height,
                    });
                }
            }

            result.push(FileInfo {
                name,
                path: path.to_string_lossy().to_string(),
                is_directory,
                dimensions,
                file_size_str,
            });
        }
    }
    Ok(result)
}

#[tauri::command]
fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(old_path, new_path).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![read_directory, rename_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
