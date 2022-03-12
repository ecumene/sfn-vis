use linked_hash_map::LinkedHashMap;
use static_dir::static_dir;
use std::env;
use std::sync::Arc;
use std::sync::Mutex;
use tokio_cron_scheduler::Job;
use tokio_cron_scheduler::JobScheduler;
use warp::Filter;

use crate::docker;

pub async fn serve() {
    let id = env::args()
        .nth(1)
        .expect("You need to specify a container id");

    let mut sched = JobScheduler::new();
    let map = Arc::new(Mutex::new(LinkedHashMap::new()));

    let warp_map = map.clone();
    let map_filter = warp::any().map(move || warp_map.clone());

    sched
        .add(
            Job::new_async("1/7 * * * * *", move |_, _| {
                let scheduler_map = map.clone();
                Box::pin(docker::gather_logs(id.clone(), scheduler_map))
            })
            .unwrap(),
        )
        .unwrap();

    let logs = warp::path("logs").and(map_filter).map(
        |map: Arc<Mutex<LinkedHashMap<String, docker::Log>>>| {
            serde_json::to_string(&map.lock().unwrap().values().collect::<Vec<&docker::Log>>())
                .unwrap()
        },
    );

    let static_files = warp::path::end().and(static_dir!("../dist"));
    let static_assets = warp::path("assets").and(static_dir!("../dist/assets"));

    let routes = logs.or(static_files).or(static_assets);

    println!("Listening on http://localhost:3117");

    tokio::spawn(sched.start());
    warp::serve(routes).run(([127, 0, 0, 1], 3117)).await;
}
