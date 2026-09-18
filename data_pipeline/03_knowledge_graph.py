"""
03_knowledge_graph.py - Infrastructure Domain Knowledge Graph Builder
Nirmaan Drishti / Infrastructure Project Monitoring (April 2001 - May 2026).

Implements:
1. Core Entities:
   - Project, ProjectSnapshot, Ministry, Department, Agency, Sector, Location (State)
   - MilestonePlan, CostRevision, ScheduleRevision, Risk, HistoricalProject
2. Core Relationships:
   - Project -> HAS_SNAPSHOT -> ProjectSnapshot
   - Project -> IMPLEMENTED_BY -> Agency
   - Project -> BELONGS_TO_MINISTRY -> Ministry
   - Project -> BELONGS_TO_SECTOR -> Sector
   - Project -> LOCATED_IN -> Location
   - ProjectSnapshot -> HAS_MILESTONE_PLAN -> MilestonePlan
   - ProjectSnapshot -> HAS_COST_REVISION -> CostRevision
   - ProjectSnapshot -> HAS_SCHEDULE_REVISION -> ScheduleRevision
   - Temporal sequence: Snapshot(t-1) -> PRECEDES -> Snapshot(t)
3. Semantic Non-Causal Risk Relationships (Section 14):
   - Scope Expansion -[INDICATES]-> Potential Additional Work -[MAY_CONTRIBUTE_TO]-> Delay Risk
   - Physical-Financial Divergence -[ASSOCIATED_WITH]-> Execution Inefficiency -[INDICATES]-> Cost Overrun Risk
   - Repeated Extensions -[INDICATES]-> Schedule Instability -[MAY_CONTRIBUTE_TO]-> Delay Risk
   - Reporting Gap -[INDICATES]-> State Uncertainty -[ASSOCIATED_WITH]-> Lower Prediction Confidence
"""

import sys
import os
import json
from pathlib import Path
from typing import Tuple, Dict, List, Any
import numpy as np
import pandas as pd

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

WORKSPACE_ROOT = Path(r"d:\Nirmaan-Drishti-secret-")
TRAJECTORY_DIR = WORKSPACE_ROOT / "data" / "04_project_trajectories"
KG_DIR = WORKSPACE_ROOT / "data" / "06_knowledge_graph"

KG_DIR.mkdir(parents=True, exist_ok=True)


def build_knowledge_graph(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame, dict]:
    print("=" * 80)
    print("STEP 1: EXTRACTING CORE KNOWLEDGE GRAPH ENTITIES")
    print("=" * 80)

    nodes = []
    edges = []

    # 1. Project Entities
    proj_unique = df.drop_duplicates(subset=["effective_project_key"]).copy()
    for _, row in proj_unique.iterrows():
        nodes.append({
            "node_id": f"Project:{row['effective_project_key']}",
            "entity_type": "Project",
            "name": row["project_name"],
            "normalized_name": row["normalized_project_name"],
            "project_id": row["project_id"] if pd.notna(row["project_id"]) else None,
            "has_project_id": bool(row["has_project_id"]),
            "identifier_type": row["identifier_type"],
            "operational_status": row["operational_status"],
            "original_cost_crore": float(row["original_cost_crore"]) if pd.notna(row["original_cost_crore"]) else None,
            "trajectory_completeness": row["trajectory_completeness"],
            "reporting_status": row["reporting_status"],
            "total_snapshots": int(row["trajectory_coverage_months"])
        })

    print(f"  -> Extracted {len(proj_unique):,} Project entities.")

    # 2. Ministry Entities
    ministries = df["ministry_department"].dropna().unique()
    for m in ministries:
        if m != "UNKNOWN":
            nodes.append({
                "node_id": f"Ministry:{m}",
                "entity_type": "Ministry",
                "name": m
            })
    print(f"  -> Extracted {len(ministries):,} Ministry entities.")

    # 3. Sector Entities
    sectors = df["sector"].dropna().unique()
    for s in sectors:
        if s != "UNKNOWN":
            nodes.append({
                "node_id": f"Sector:{s}",
                "entity_type": "Sector",
                "name": s
            })
    print(f"  -> Extracted {len(sectors):,} Sector entities.")

    # 4. Agency Entities
    agencies = df["agency"].dropna().unique()
    for a in agencies:
        if a != "UNKNOWN":
            nodes.append({
                "node_id": f"Agency:{a}",
                "entity_type": "Agency",
                "name": a
            })
    print(f"  -> Extracted {len(agencies):,} Agency entities.")

    # 5. Location / State Entities
    states = df["state"].dropna().unique()
    for st in states:
        if st != "UNKNOWN":
            nodes.append({
                "node_id": f"Location:{st}",
                "entity_type": "Location",
                "name": st
            })
    print(f"  -> Extracted {len(states):,} Location entities.")

    # 6. Abstract Semantic Risk Concepts (Section 14)
    risk_concepts = [
        {"node_id": "RiskConcept:ScopeExpansion", "name": "Scope Expansion", "category": "Scope"},
        {"node_id": "RiskConcept:AdditionalWork", "name": "Potential Additional Work", "category": "Execution"},
        {"node_id": "RiskConcept:ScheduleDelayRisk", "name": "Schedule Delay Risk", "category": "Outcome"},
        {"node_id": "RiskConcept:PhysicalFinancialDivergence", "name": "Physical-Financial Divergence", "category": "Efficiency"},
        {"node_id": "RiskConcept:ExecutionInefficiency", "name": "Potential Execution Inefficiency", "category": "Execution"},
        {"node_id": "RiskConcept:CostEscalationRisk", "name": "Cost Escalation Risk", "category": "Outcome"},
        {"node_id": "RiskConcept:RepeatedExtensions", "name": "Repeated Extensions", "category": "Schedule"},
        {"node_id": "RiskConcept:ScheduleInstability", "name": "Schedule Instability", "category": "Schedule"},
        {"node_id": "RiskConcept:ReportingGap", "name": "Reporting Gap", "category": "Information"},
        {"node_id": "RiskConcept:StateUncertainty", "name": "Current-State Uncertainty", "category": "Information"},
        {"node_id": "RiskConcept:LowerPredictionConfidence", "name": "Lower Prediction Confidence", "category": "Governance"},
    ]
    for rc in risk_concepts:
        nodes.append({
            "node_id": rc["node_id"],
            "entity_type": "RiskConcept",
            "name": rc["name"],
            "category": rc["category"]
        })

    # Semantic Risk Ontology Edges (Strictly non-causal: INDICATES, ASSOCIATED_WITH, MAY_CONTRIBUTE_TO)
    ontology_edges = [
        ("RiskConcept:ScopeExpansion", "INDICATES", "RiskConcept:AdditionalWork"),
        ("RiskConcept:AdditionalWork", "MAY_CONTRIBUTE_TO", "RiskConcept:ScheduleDelayRisk"),
        ("RiskConcept:AdditionalWork", "MAY_CONTRIBUTE_TO", "RiskConcept:CostEscalationRisk"),
        ("RiskConcept:PhysicalFinancialDivergence", "ASSOCIATED_WITH", "RiskConcept:ExecutionInefficiency"),
        ("RiskConcept:ExecutionInefficiency", "INDICATES", "RiskConcept:CostEscalationRisk"),
        ("RiskConcept:RepeatedExtensions", "INDICATES", "RiskConcept:ScheduleInstability"),
        ("RiskConcept:ScheduleInstability", "MAY_CONTRIBUTE_TO", "RiskConcept:ScheduleDelayRisk"),
        ("RiskConcept:ReportingGap", "INDICATES", "RiskConcept:StateUncertainty"),
        ("RiskConcept:StateUncertainty", "ASSOCIATED_WITH", "RiskConcept:LowerPredictionConfidence"),
    ]
    for src, rel, dst in ontology_edges:
        edges.append({
            "source": src,
            "relationship": rel,
            "target": dst,
            "relationship_type": "SEMANTIC_RISK",
            "weight": 1.0
        })

    print(f"  -> Defined {len(risk_concepts)} Semantic Risk Concepts & {len(ontology_edges)} Non-Causal Semantic Edges.")

    print("\n" + "=" * 80)
    print("STEP 2: EXTRACTING STRUCTURAL PROJECT RELATIONSHIPS")
    print("=" * 80)

    for _, row in proj_unique.iterrows():
        p_id = f"Project:{row['effective_project_key']}"

        # BELONGS_TO_MINISTRY
        if pd.notna(row["ministry_department"]) and row["ministry_department"] != "UNKNOWN":
            edges.append({
                "source": p_id,
                "relationship": "BELONGS_TO_MINISTRY",
                "target": f"Ministry:{row['ministry_department']}",
                "relationship_type": "STRUCTURAL",
                "weight": 1.0
            })

        # BELONGS_TO_SECTOR
        if pd.notna(row["sector"]) and row["sector"] != "UNKNOWN":
            edges.append({
                "source": p_id,
                "relationship": "BELONGS_TO_SECTOR",
                "target": f"Sector:{row['sector']}",
                "relationship_type": "STRUCTURAL",
                "weight": 1.0
            })

        # IMPLEMENTED_BY
        if pd.notna(row["agency"]) and row["agency"] != "UNKNOWN":
            edges.append({
                "source": p_id,
                "relationship": "IMPLEMENTED_BY",
                "target": f"Agency:{row['agency']}",
                "relationship_type": "STRUCTURAL",
                "weight": 1.0
            })

        # LOCATED_IN
        if pd.notna(row["state"]) and row["state"] != "UNKNOWN":
            edges.append({
                "source": p_id,
                "relationship": "LOCATED_IN",
                "target": f"Location:{row['state']}",
                "relationship_type": "STRUCTURAL",
                "weight": 1.0
            })

    print(f"  -> Generated {len(edges):,} structural project-organization edges.")

    print("\n" + "=" * 80)
    print("STEP 3: EXTRACTING SNAPSHOTS, TEMPORAL CHAINS & RISK INSTANCES")
    print("=" * 80)

    # We sample snapshots for graph representation to maintain high performance while capturing all key events
    # Every project has: first snapshot, latest snapshot, any revision/expansion snapshot, and annual checkpoints
    df["report_date_str"] = df["report_month"].dt.strftime("%Y-%m")
    df["is_first_snap"] = df["snapshot_history_count"] == 1
    df["is_latest_snap"] = df["report_month"] == df["latest_observation_date"]
    df["has_event"] = (
        (df["scope_expansion_flag"] == 1) |
        (df["scope_reduction_flag"] == 1) |
        (df["milestone_revision_flag"] == 1) |
        (df["reporting_staleness_flag"] == 1) |
        (df["physical_financial_divergence"] > 20.0) |
        (df["schedule_extension_months"] > 12.0)
    )
    df["is_annual"] = df["report_month"].dt.month == 3  # March annual checkpoint

    kg_snap_mask = df["is_first_snap"] | df["is_latest_snap"] | df["has_event"] | df["is_annual"]
    kg_snaps = df[kg_snap_mask].copy()

    print(f"Selected {len(kg_snaps):,} salient snapshot nodes across all {kg_snaps['effective_project_key'].nunique():,} projects.")

    prev_snap_by_proj = {}
    for _, row in kg_snaps.iterrows():
        pkey = row["effective_project_key"]
        s_date = row["report_date_str"]
        snap_node_id = f"Snapshot:{pkey}@{s_date}"

        nodes.append({
            "node_id": snap_node_id,
            "entity_type": "ProjectSnapshot",
            "project_key": pkey,
            "report_month": s_date,
            "physical_progress_pct": float(row["physical_progress_clean"]),
            "cost_overrun_pct": float(row["cost_overrun_pct"]),
            "schedule_extension_months": float(row["schedule_extension_months"]),
            "milestones_achieved": float(row["milestones_completed"]) if pd.notna(row["milestones_completed"]) else None,
            "milestones_total": float(row["milestones_total"]) if pd.notna(row["milestones_total"]) else None,
            "scope_instability_score": float(row["scope_instability_score"]),
            "reporting_reliability_score": float(row["reporting_reliability_score"])
        })

        # Project -> HAS_SNAPSHOT -> Snapshot
        edges.append({
            "source": f"Project:{pkey}",
            "relationship": "HAS_SNAPSHOT",
            "target": snap_node_id,
            "relationship_type": "TEMPORAL",
            "weight": 1.0
        })

        # Snapshot(t-1) -> PRECEDES -> Snapshot(t)
        if pkey in prev_snap_by_proj:
            prev_id = prev_snap_by_proj[pkey]
            edges.append({
                "source": prev_id,
                "relationship": "PRECEDES",
                "target": snap_node_id,
                "relationship_type": "TEMPORAL_CHAIN",
                "weight": 1.0
            })
        prev_snap_by_proj[pkey] = snap_node_id

        # Connect snapshot to Semantic Risk Concepts when active
        if row["scope_expansion_flag"] == 1:
            edges.append({
                "source": snap_node_id,
                "relationship": "EXHIBITS",
                "target": "RiskConcept:ScopeExpansion",
                "relationship_type": "RISK_LINKAGE",
                "weight": float(row["scope_change_ratio"])
            })

        if row["physical_financial_divergence"] > 20.0:
            edges.append({
                "source": snap_node_id,
                "relationship": "EXHIBITS",
                "target": "RiskConcept:PhysicalFinancialDivergence",
                "relationship_type": "RISK_LINKAGE",
                "weight": float(row["physical_financial_divergence"] / 100.0)
            })

        if row["reporting_staleness_flag"] == 1:
            edges.append({
                "source": snap_node_id,
                "relationship": "EXHIBITS",
                "target": "RiskConcept:ReportingGap",
                "relationship_type": "RISK_LINKAGE",
                "weight": float(row["reporting_gap_months"])
            })

        if row["extension_count"] >= 3:
            edges.append({
                "source": snap_node_id,
                "relationship": "EXHIBITS",
                "target": "RiskConcept:RepeatedExtensions",
                "relationship_type": "RISK_LINKAGE",
                "weight": float(row["extension_count"])
            })

    df_nodes = pd.DataFrame(nodes)
    df_edges = pd.DataFrame(edges)

    stats = {
        "total_nodes": len(df_nodes),
        "total_edges": len(df_edges),
        "node_types": df_nodes["entity_type"].value_counts().to_dict(),
        "edge_types": df_edges["relationship"].value_counts().to_dict()
    }

    return df_nodes, df_edges, stats


def main():
    p_in = TRAJECTORY_DIR / "project_trajectories.parquet"
    print(f"Reading project trajectories from {p_in}...")
    df = pd.read_parquet(p_in)

    df_nodes, df_edges, stats = build_knowledge_graph(df)

    out_nodes = KG_DIR / "kg_nodes.parquet"
    out_edges = KG_DIR / "kg_edges.parquet"
    out_summary = KG_DIR / "kg_summary.json"

    print(f"\nSaving Knowledge Graph nodes to {out_nodes}...")
    df_nodes.to_parquet(out_nodes, index=False)
    print(f"Saving Knowledge Graph edges to {out_edges}...")
    df_edges.to_parquet(out_edges, index=False)

    with open(out_summary, "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2)

    print("\n" + "=" * 80)
    print("KNOWLEDGE GRAPH SUMMARY STATISTICS")
    print("=" * 80)
    print(f"Total Nodes : {stats['total_nodes']:,}")
    print(f"Total Edges : {stats['total_edges']:,}")
    print("\nNode Counts by Entity Type:")
    for k, v in stats["node_types"].items():
        print(f"  - {k:<20}: {v:>8,}")
    print("\nEdge Counts by Relationship Type:")
    for k, v in stats["edge_types"].items():
        print(f"  - {k:<25}: {v:>8,}")


if __name__ == "__main__":
    main()
