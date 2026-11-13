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
    #[serde(default)]
    pub order: Option<u64>,
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

#[cfg(test)]
mod tests {
    use super::Task;

    #[test]
    fn task_order_is_backward_compatible_and_persisted() {
        let legacy = r#"{"id":"a","title":"Task","details":"","completed":false,"pinned":false,"timestamp":1,"deadline":null}"#;
        let mut task: Task = serde_json::from_str(legacy).unwrap();
        assert_eq!(task.order, None);
        task.order = Some(2);
        let saved = serde_json::to_string(&task).unwrap();
        let loaded: Task = serde_json::from_str(&saved).unwrap();
        assert_eq!(loaded.order, Some(2));
    }
}
