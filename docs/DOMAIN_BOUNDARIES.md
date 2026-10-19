# Domain Boundaries

| Boundary | Owns | Must not do |
| --- | --- | --- |
| Curriculum and resources | IDs, metadata, attribution, validation | Store learner progress |
| Roadmap and analytics | Deterministic derivation from source records | Invent activity or mutate raw records |
| Local progress | Guest state and offline records | Publish private records |
| Sync and auth | Authenticated identity and scoped server writes | Accept arbitrary user IDs |
| Portfolio | Explicit public allow-list serialization | Leak private settings or evidence |
| MCP | Validated read adapter and policy enforcement | SQL, shell, arbitrary writes, or hidden auth |
