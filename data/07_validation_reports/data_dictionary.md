# Nirmaan Drishti — Data Dictionary

Catalog of core features, definitions, data types, missingness, and allowable ranges in the authoritative trajectory dataset.

| Column Name | Description | Data Type | Source Stage | Missingness | Allowed Range / Values |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `effective_project_key` | Unified project identifier (`ID:...` or `NAME:...`) | string | Ingestion | 0.0% | Unique string |
| `project_id` | Official OCMS / Project code (NULL for pre-2011 name projects) | string | Raw Source | 2.1% | Numeric string or NULL |
| `project_name` | Original project name | string | Raw Source | 0.0% | Text |
| `normalized_project_name` | Standardized lowercase project name for matching | string | Ingestion | 0.0% | Text |
| `has_project_id` | Flag indicating whether project has official ID | bool | Ingestion | 0.0% | True / False |
| `identifier_type` | Identity classification | string | Ingestion | 0.0% | `OFFICIAL_ID`, `PROJECT_NAME` |
| `operational_status` | Status category | string | Ingestion | 0.0% | `COMPLETED`, `ONGOING_ACTIVE`, `ONGOING_NON_ACTIVE` |
| `sector` | Infrastructure sector | string | Raw Source | 0.0% | Categorical |
| `ministry_department` | Ministry / Department name | string | Raw Source | 0.0% | Categorical |
| `state` | Implementation State / Location | string | Raw Source | 5.9% | Categorical |
| `report_month` | Reporting snapshot timestamp (1st of month) | datetime64 | Ingestion | 0.0% | 2001-04-01 to 2026-05-01 |
| `approval_date` | Official project approval date | datetime64 | Raw Source | 0.1% | Date |
| `original_doc` | Original Date of Commissioning | datetime64 | Raw Source | 2.5% | Date |
| `anticipated_doc` | Current Anticipated Date of Commissioning | datetime64 | Raw Source | 5.1% | Date |
| `original_cost_crore` | Sanctioned original cost in Crore | float64 | Trajectory | 0.0% | $\ge 0$ (imputed baseline $\ge 150$) |
| `anticipated_cost_crore` | Current anticipated cost in Crore | float64 | Trajectory | 0.0% | $\ge 0$ |
| `cumulative_expenditure_crore` | Cumulative expenditure incurred in Crore | float64 | Trajectory | 0.0% | $\ge 0$ |
| `physical_progress_clean` | Reported physical completion percentage | float64 | Trajectory | 0.0% | $[0.0, 100.0]$ |
| `cost_overrun_pct` | Percentage cost escalation over original | float64 | Trajectory | 0.0% | $[-50.0, 1000.0]$ |
| `schedule_extension_months` | Schedule slippage in months from original DOC | float64 | Trajectory | 0.0% | $[-60.0, 360.0]$ |
| `milestones_completed` | Completed milestones count | float64 | Trajectory | 11.2% | $\ge 0$ |
| `milestones_total` | Total milestone baseline count | float64 | Trajectory | 11.2% | $\ge 0$ |
| `milestone_progress_pct` | Reported milestone progress percentage | float64 | Trajectory | 11.2% | $[0.0, 100.0]$ |
| `scope_expansion_flag` | Flag: Total milestone baseline increased | int64 | Trajectory | 0.0% | 0, 1 |
| `scope_reduction_flag` | Flag: Total milestone baseline decreased | int64 | Trajectory | 0.0% | 0, 1 |
| `milestone_revision_flag` | Flag: Completed milestone reversed/revised | int64 | Trajectory | 0.0% | 0, 1 |
| `milestone_event_type` | Milestone event classification | string | Trajectory | 0.0% | `NORMAL_PROGRESS`, `PROGRESS_AND_SCOPE_EXPANSION`, `SCOPE_EXPANSION_PROGRESS_DILUTION`, `SCOPE_REDUCTION`, `MILESTONE_REVISION`, `NO_CHANGE` |
| `number_of_milestone_plan_changes` | Cumulative count of milestone plan adjustments | int64 | Trajectory | 0.0% | $\ge 0$ |
| `scope_instability_score` | Metric of scope volatility | float64 | Trajectory | 0.0% | $\ge 0$ |
| `trajectory_completeness` | Historical coverage category | string | Trajectory | 0.0% | `Complete`, `Partial`, `Late-entry` |
| `reporting_status` | Activity staleness tier | string | Trajectory | 0.0% | `RECENT`, `STALE`, `LONG_STALE` |
| `reporting_staleness_flag` | Flag: Gap between snapshots $\ge 5$ months | int64 | Trajectory | 0.0% | 0, 1 |
| `reporting_reliability_score` | Continuity score of reporting cadence | float64 | Trajectory | 0.0% | $[0.0, 1.0]$ |
| `progress_velocity` | Physical progress % per elapsed month | float64 | Trajectory | 0.0% | Velocity |
| `progress_acceleration` | Rate of change of progress velocity | float64 | Trajectory | 0.0% | Acceleration |
| `physical_financial_divergence` | Expenditure ratio % minus Physical progress % | float64 | Trajectory | 0.0% | $[ -100.0, 500.0 ]$ |
| `nearest_project_similarity` | Cosine similarity to closest completed analogue | float64 | Similarity | 0.0% | $[ -1.0, 1.0 ]$ |
| `mean_similarity_top_k` | Mean similarity to top-5 completed analogues | float64 | Similarity | 0.0% | $[ -1.0, 1.0 ]$ |
| `median_delay_top_k` | Median observed delay of top-5 analogues | float64 | Similarity | 0.0% | Months |
| `mean_cost_escalation_top_k` | Mean observed cost escalation % of top-5 analogues | float64 | Similarity | 0.0% | Percentage |
| `sector_historical_avg_delay` | Point-in-time sector historical average delay | float64 | Knowledge Graph | 0.0% | Months |
| `sector_historical_avg_cost_overrun` | Point-in-time sector historical average overrun % | float64 | Knowledge Graph | 0.0% | Percentage |
