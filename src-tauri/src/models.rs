use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub details: String,
    pub completed: bool,
    pub pinned: bool,
    pub timestamp: i64,
    pub deadline: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Settings {
    pub opacity: f32,
    #[serde(rename = "fontSize")]
    pub font_size: u32,
    #[serde(rename = "alwaysOnTop")]
    pub always_on_top: bool,
    #[serde(rename = "autoStart")]
    pub auto_start: bool,
    pub height: u32,
    pub x: Option<i32>,
    pub y: Option<i32>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BackupData {
    pub tasks: Vec<Task>,
    pub archive: Vec<Task>,
    pub settings: Settings,
    pub version: String,
    pub timestamp: i64,
}
