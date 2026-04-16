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
    pub height: u32,
}
