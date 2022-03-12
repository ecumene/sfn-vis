use linked_hash_map::LinkedHashMap;
use serde::{Deserialize, Serialize};
use std::str;
use std::sync::Arc;
use std::sync::Mutex;

use futures::StreamExt;
use shiplift::{tty::TtyChunk, Docker, LogsOptions};

#[derive(Debug, Serialize, Deserialize)]
pub struct Log {
    date: String,
    #[serde(rename = "executionArn")]
    execution_arn: String,
    message: serde_json::Value,
}

pub async fn gather_logs(id: String, map: Arc<Mutex<LinkedHashMap<String, Log>>>) {
    let docker = Docker::new();

    let mut logs_stream = docker
        .containers()
        .get(&id)
        .logs(&LogsOptions::builder().stdout(true).stderr(true).build());

    // let mut buffer: Vec<Vec<u8>> = vec![];

    while let Some(log_result) = logs_stream.next().await {
        match log_result {
            Ok(chunk) => match chunk {
                TtyChunk::StdOut(bytes) => {
                    let escaped = strip_ansi_escapes::strip(bytes).unwrap();
                    let stdout_line: String = String::from_utf8(escaped).unwrap();
                    // todo: load all these into a buffer then have these be references to it
                    let mut split = stdout_line.split(": ").map(str::trim).map(String::from);
                    if let (Some(date), Some(execution_arn)) = (split.next(), split.next()) {
                        if execution_arn.starts_with("arn:aws:states:") {
                            let msg_src = split.collect::<Vec<String>>().join(": ");
                            let message_parsed = serde_json::from_str(&msg_src);
                            if let Ok(message) = message_parsed {
                                let log = Log {
                                    date: date.to_string(),
                                    execution_arn: execution_arn.to_string(),
                                    message,
                                };
                                map.lock().unwrap().insert(date, log);
                            }
                        }
                    }
                }
                TtyChunk::StdErr(_) => {}
                TtyChunk::StdIn(_) => unreachable!(),
            },
            Err(e) => eprintln!("Error: {}", e),
        }
    }
}
