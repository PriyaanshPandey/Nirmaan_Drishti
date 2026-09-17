# Nirmaan Drishti — Comprehensive Data Quality & Validation Report

**Execution Date**: 2026-09-12  
**Dataset Time Horizon**: April 2001 to May 2026 (25-year longitudinal coverage)  
**Total Canonical Snapshots**: 217,188  
**Total Unique Projects**: 5,164  

---

## 1. Dataset Statistics

| Metric | Value | Details |
| :--- | :--- | :--- |
| **Total Projects Monitored** | **5,164** | Authoritative infrastructure projects |
| - Projects with Official ID | **4,984** | Tracked by official OCMS / Project code |
| - Projects Identified by Name | **180** | Pre-2011 completed projects (Zero fake IDs invented) |
| **Total Monthly Snapshots** | **217,188** | Deduplicated monthly time-series panel |
| - Snapshots without Official ID | **4,601** | 2.12% of panel, linked via normalized project names |
| **Operational Status Breakdown** | | |
| - Completed Projects | **1,466** projects | 62,687 snapshots (2001–2026 full trajectory) |
| - Ongoing Active Projects | **1,379** projects | 45,576 snapshots (2011–2026 active panel) |
| - Ongoing Non-Active Projects | **2,325** projects | 108,925 snapshots (2011–2025 non-active panel) |
| **Date Range** | **2001-04 to 2026-05** | 302 consecutive reporting calendar months |

---

## 2. Incomplete Trajectories & Staleness Breakdown

### Trajectory Coverage Completeness (Section 5)
- **Complete Trajectory**: 102,568 snapshots (47.23%) — Observed within 12 months of project approval.
- **Partial Trajectory**: 71,467 snapshots (32.91%) — Entered between 12–36 months or contains gaps.
- **Late-Entry Trajectory**: 43,153 snapshots (19.87%) — Approved $>36$ months before earliest monitoring observation (historical observations preserved as missing without fabrication).

### Activity & Reporting Staleness (Section 6)
- **RECENT**: 48,324 snapshots (22.25%) — Update received within 3 months of observation boundary / 2026.
- **STALE**: 31,005 snapshots (14.28%) — Inactivity between 3 and 12 months.
- **LONG_STALE**: 137,859 snapshots (63.47%) — No report for $>12$ months (retained as reporting uncertainty rather than misclassifying as delay/cancellation).

---

## 3. Milestone Dynamics & Scope Instability Analysis (Sections 7–10)

Crucial mathematical distinction: When milestones change from e.g. $23/52 	o 24/58$, the reported milestone percentage drops from $44.2\% 	o 41.4\%$ while completed milestones increased by $+1$. This is explicitly detected as **scope expansion**, not physical project regression.

| Milestone Event Type | Snapshot Count | Percentage | Interpretation |
| :--- | :---: | :---: | :--- |
| **NO_CHANGE** | 211,431 | 97.35% | Steady monthly cadence without milestone adjustments |
| **NORMAL_PROGRESS** | 4,083 | 1.88% | Completed milestone increments with stable total baseline |
| **PROGRESS_AND_SCOPE_EXPANSION** | 801 | 0.37% | Both completed and total milestones increased |
| **SCOPE_EXPANSION_PROGRESS_DILUTION** | 72 | 0.03% | Total increased faster than completed (apparent percentage drop) |
| **SCOPE_REDUCTION** | 555 | 0.26% | Total milestone baseline reduced administratively |
| **MILESTONE_REVISION** | 246 | 0.11% | Completed milestone decreased (flagged as administrative revision/re-baselining) |

- **Total Scope Expansion Events**: **2,448**
- **Total Scope Reduction Events**: **555**
- **Total Apparent Reversals (Revisions)**: **503**
- **Reporting Gaps ($\ge 5$ Months)**: **968**

---

## 4. Knowledge Graph Statistics (Sections 13–14)

The domain knowledge graph captures physical, administrative, and semantic risk relationships:

- **Total Graph Nodes**: **150,332**
  - Projects: 5,164
  - Salient Project Snapshots: 144,193
  - Ministries: 318
  - Agencies: 219
  - Sectors: 24
  - Locations: 403
  - Risk Concepts: 11
- **Total Graph Edges**: **455,792**
  - Temporal Snapshot Sequence (`PRECEDES`): 139,029
  - Snapshot Membership (`HAS_SNAPSHOT`): 144,193
  - Semantic Risk Exhibited (`EXHIBITS`): 152,464
  - Non-Causal Risk Ontology (`INDICATES`, `MAY_CONTRIBUTE_TO`, `ASSOCIATED_WITH`): 9

---

## 5. Leakage-Free Verification Summary (Section 16)

1. **Zero Future Target Leakage**: Future targets ($T+3$, $T+6$, Final outcomes) are strictly segregated and queried forward. No future cost or completion dates exist in the feature matrix.
2. **Point-in-Time Trajectory Similarity**: Top-5 analogues are queried strictly from completed projects certified *prior to* the snapshot timestamp.
3. **Point-in-Time Sector Aggregations**: Historical sector and ministry delays are computed strictly from completed projects finalized in earlier calendar years.
4. **Strict Temporal Partitioning**:
   - Training: 2001-04 to 2022-12 (159,016 snapshots)
   - Validation: 2023-01 to 2024-06 (28,399 snapshots)
   - Test: 2024-07 to 2026-05 (29,773 snapshots)
   - Guarantee: $\max(T_\text{train}) < \min(T_\text{val}) < \min(T_\text{test})$.
