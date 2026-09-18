# Nirmaan Drishti — Authoritative Data Lineage

This document establishes the end-to-end data lineage for the Nirmaan Drishti infrastructure monitoring and predictive forecasting system, spanning **April 2001 to May 2026**.

```text
01_raw / Authoritative Sources
  ├── Completed Projects (2001 to May 2026): 62,701 snapshots across 1,477 projects
  ├── Ongoing Non-Active (2011 to 2025): 109,229 snapshots across 2,328 projects
  └── Ongoing Active (2011 to May 2026): 47,395 snapshots across 1,379 projects
          │
          ▼
02_canonical_pipeline (01_canonical_ingestion.py)
  ├── Audit & De-corruption: Rectified column shift in ongoing project detail
  ├── Project Identity: Enforced zero invented IDs (project_id = NULL for pre-2011 name-based projects)
  ├── Validation: Progress [0, 100], Cost sanity, Date sanity
  ├── Deduplication: Deduplicated 3,849 redundant snapshots across (effective_project_key, report_month)
  └── Canonical Validated Store: data/03_validated/canonical_project_snapshots.parquet (217,188 snapshots, 5,164 projects)
          │
          ▼
03_trajectory_engine (02_trajectory_builder.py)
  ├── Chronological Ordering: Strict ascending order per project
  ├── Incomplete Historical Trajectories: Coverage, completeness classification (Complete, Partial, Late-entry)
  ├── Reporting Staleness & Gaps: RECENT, STALE, LONG_STALE, UNKNOWN
  ├── Milestone Dynamics: Distinction between progress (23/52 -> 27/52) and scope expansion (23/52 -> 24/58)
  ├── Scope Instability: Plan change count, cumulative expansion, instability score
  ├── Velocities & Accelerations: Physical, financial, expenditure, schedule delay
  └── Trajectory Store: data/04_project_trajectories/project_trajectories.parquet
          │
          ▼
04_knowledge_graph (03_knowledge_graph.py)
  ├── Core Entities (150,332 nodes): Project, ProjectSnapshot, Ministry, Agency, Sector, Location, RiskConcept
  ├── Structural & Temporal Edges (455,792 edges): HAS_SNAPSHOT, BELONGS_TO, IMPLEMENTED_BY, PRECEDES
  ├── Non-Causal Semantic Risk Ontology: INDICATES, ASSOCIATED_WITH, MAY_CONTRIBUTE_TO
  └── Graph Store: data/06_knowledge_graph/ (kg_nodes.parquet, kg_edges.parquet)
          │
          ▼
05_similarity_engine (04_similarity_engine.py)
  ├── Trajectory Embeddings: Vector representations of project state
  ├── Point-in-Time Analogue Matching: Query 1,466 completed project outcomes strictly up to prediction date
  ├── Analogue Evidence: Nearest similarity, mean similarity top-k, median delay top-k, mean cost escalation top-k
  └── Similarity Store: data/04_project_trajectories/project_trajectories_with_similarity.parquet
          │
          ▼
06_ml_feature_generator (05_ml_feature_generator.py)
  ├── Forward Targets: 3M, 6M Anticipated Cost, Schedule Delay, Risk Tiers, and deltas
  ├── Time-Aware Sector Statistics: Historical sector delay and cost overrun strictly from past completed projects
  ├── Strict Temporal Split:
  │     ├── Train: 2001-04 to 2022-12 (159,016 snapshots, 3,559 projects)
  │     ├── Validation: 2023-01 to 2024-06 (28,399 snapshots, 2,284 projects)
  │     └── Final Holdout Test: 2024-07 to 2026-05 (29,773 snapshots, 2,517 projects)
  └── ML Feature Store: data/05_ml_features/ (train.parquet, val.parquet, test.parquet)
```

### Reproducibility
All transformation stages are fully scripted and can be re-executed via:
```bash
python data_pipeline/01_canonical_ingestion.py
python data_pipeline/02_trajectory_builder.py
python data_pipeline/03_knowledge_graph.py
python data_pipeline/04_similarity_engine.py
python data_pipeline/05_ml_feature_generator.py
```
