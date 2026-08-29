"""
Streamlit Temporary Demo UI for Nirmaan Dristi ML Prediction Engine.

Features:
- Project health & status cards
- Forecasts for 3-month & 6-month horizons (Cost & Schedule)
- Exact timeline calculations (Time Elapsed, Time Remaining, Tentative Completion Date)
- Natural language explanations via Qwen3-8B (with deterministic SHAP fallback)
- Interactive grounded Q&A Project Assistant
- Technical SHAP feature attributions
- Historical trajectory visualization
"""

import sys
from pathlib import Path

# Add project root to sys.path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px

from src.data_loader import load_master_csv, load_config
from src.validation import validate_dataset, print_validation_report
from src.predict import load_all_models
from src.project_service import (
    get_full_prediction, load_project_history,
    get_project_list, get_project_info, get_current_status,
    get_completed_project_summary, get_project_timeline,
    format_calendar_duration, add_months_to_date
)
from src.qwen_service import (
    QwenExplainer, build_explanation_payload, build_project_chat_context
)

# --- Page Config ---
st.set_page_config(
    page_title="Nirmaan Dristi — AI Prediction Engine",
    page_icon="🔮",
    layout="wide",
)

st.title("🔮 Nirmaan Dristi — AI Prediction Engine")
st.caption("Forecasting Incremental Cost Escalation & Schedule Delay for Central Sector Projects")


# --- Session State ---
if "df" not in st.session_state:
    st.session_state.df = None
if "models" not in st.session_state:
    st.session_state.models = None
if "config" not in st.session_state:
    st.session_state.config = None

explainer = QwenExplainer()
status_info = explainer.get_status()

# --- Sidebar ---
with st.sidebar:
    st.header("⚙️ Configuration")

    csv_option = st.radio("Data Source", ["Default Path", "Custom Path", "Upload File"])

    csv_path = None
    if csv_option == "Default Path":
        config = load_config()
        default_path = project_root / config["data"]["default_csv_path"]
        st.text(f"Path: {default_path}")
        csv_path = str(default_path)
    elif csv_option == "Custom Path":
        csv_path = st.text_input("CSV Path", value="")
    else:
        uploaded = st.file_uploader("Upload Master CSV", type=["csv"])
        if uploaded:
            temp_path = project_root / "data" / "input" / "uploaded_master.csv"
            temp_path.parent.mkdir(parents=True, exist_ok=True)
            with open(temp_path, "wb") as f:
                f.write(uploaded.read())
            csv_path = str(temp_path)

    if st.button("📂 Load Dataset", type="primary"):
        if csv_path and Path(csv_path).exists():
            try:
                config = load_config()
                st.session_state.config = config
                st.session_state.df = load_master_csv(csv_path, config)
                st.success(f"✅ Loaded {len(st.session_state.df)} rows")
            except Exception as e:
                st.error(f"Error: {e}")
        else:
            st.error("CSV file not found")

    st.divider()

    if st.button("🧠 Load Models"):
        try:
            config = load_config()
            models_dir = str(project_root / config["output"]["models_dir"])
            st.session_state.models = load_all_models(models_dir)
            if st.session_state.models:
                st.success(f"✅ Loaded {len(st.session_state.models)} model files")
            else:
                st.warning("No models found. Run train.py first.")
        except Exception as e:
            st.error(f"Error: {e}")

    st.divider()
    st.markdown("### 🤖 AI Explanation Layer")
    st.info(f"**Mode**: {status_info['status_label']}\n\n*Target Model: {status_info['model_name']}*")

    st.divider()
    st.caption("To retrain models, run:\n```\npython train.py\n```")


# --- Main Area ---
df = st.session_state.df
models = st.session_state.models

if df is None:
    # Attempt auto-load default
    try:
        config = load_config()
        st.session_state.config = config
        st.session_state.df = load_master_csv(config=config)
        df = st.session_state.df
        models_dir = str(project_root / config["output"]["models_dir"])
        st.session_state.models = load_all_models(models_dir)
        models = st.session_state.models
    except Exception:
        st.info("👈 Load a dataset from the sidebar to begin.")
        st.stop()

# --- Project Selector ---
project_ids = sorted(df["project_id"].unique().astype(str))

col1, col2 = st.columns([1, 3])
with col1:
    selected_project = st.selectbox(
        "Select Project ID",
        project_ids,
        index=0,
    )

try:
    info = get_project_info(selected_project, df)
except ValueError as e:
    st.error(str(e))
    st.stop()

with col2:
    st.subheader(f"📌 {info['project_name']}")
    meta_cols = st.columns(4)
    with meta_cols[0]:
        st.markdown(f"**Sector:** {info['sector']}")
    with meta_cols[1]:
        st.markdown(f"**Agency:** {info['agency']}")
    with meta_cols[2]:
        st.markdown(f"**State:** {info['state']}")
    with meta_cols[3]:
        st.markdown(f"**Snapshots:** {info['total_snapshots']}")

# --- Generate Unified AI Prediction & Decision Summary ---
prediction = None
if models is not None:
    try:
        prediction = get_full_prediction(selected_project, df, models)
    except Exception as e:
        st.error(f"Prediction error: {e}")

if prediction is not None:
    try:
        summary_res = explainer.generate_project_narrative_summary(selected_project, df, prediction)
        
        alerts = summary_res.get("key_alerts", [])
        alerts_title = summary_res.get("alerts_title", "Key Early Alerts")
        icon_map = {
            "Final Outcome Insights": "🏁",
            "Final-Stage Insights": "🔍",
            "Initial Project Insights": "📋",
            "Key Early Alerts": "🚨",
        }
        icon = icon_map.get(alerts_title, "🚨")
        
        card_theme_map = {
            "Final Outcome Insights": "ai-insight-card-completed",
            "Final-Stage Insights": "ai-insight-card-finalstage",
            "Initial Project Insights": "ai-insight-card-initial",
            "Key Early Alerts": "ai-insight-card-active",
        }
        card_theme = card_theme_map.get(alerts_title, "ai-insight-card-active")

        import textwrap
        
        # Clean narrative text to avoid embedded markdown block formatting
        summary_clean = str(summary_res['summary']).strip().replace("\n", " ")

        # Custom Scoped CSS & HTML for AI Project Summary Box (Zero leading indentation)
        summary_html = textwrap.dedent(f"""
<style>
.ai-summary-box {{
    background: rgba(99, 102, 241, 0.07);
    border: 1px solid rgba(99, 102, 241, 0.35);
    border-left: 5px solid #818cf8;
    border-radius: 10px;
    padding: 1.25rem 1.4rem;
    margin: 0.5rem 0 1.25rem 0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}}
.ai-summary-top {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid rgba(129, 140, 248, 0.25);
}}
.ai-summary-headline {{
    font-size: 1.1rem;
    font-weight: 700;
    color: #a5b4fc;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0;
}}
.ai-summary-tag {{
    background: rgba(99, 102, 241, 0.22);
    color: #c7d2fe;
    font-size: 0.78rem;
    font-weight: 600;
    padding: 0.2rem 0.7rem;
    border-radius: 16px;
    border: 1px solid rgba(129, 140, 248, 0.4);
    letter-spacing: 0.02em;
}}
.ai-summary-body {{
    font-size: 0.96rem;
    line-height: 1.68;
    color: #f1f5f9;
    font-weight: 400;
    margin: 0;
    text-align: justify;
}}
.ai-insights-header-text {{
    font-size: 0.95rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 1.2rem 0 0.6rem 0;
    display: flex;
    align-items: center;
    gap: 0.35rem;
}}
.ai-insight-card {{
    background: rgba(30, 41, 59, 0.65);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 8px;
    padding: 0.85rem 1rem;
    height: 100%;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}}
.ai-insight-card-completed {{ border-top: 3px solid #10b981; }}
.ai-insight-card-finalstage {{ border-top: 3px solid #f59e0b; }}
.ai-insight-card-initial {{ border-top: 3px solid #38bdf8; }}
.ai-insight-card-active {{ border-top: 3px solid #f43f5e; }}
.ai-insight-topic {{
    font-size: 0.88rem;
    font-weight: 700;
    color: #f8fafc;
    margin-bottom: 0.35rem;
}}
.ai-insight-detail {{
    font-size: 0.83rem;
    line-height: 1.45;
    color: #cbd5e1;
    margin-bottom: 0.2rem;
}}
</style>

<div class="ai-summary-box">
<div class="ai-summary-top">
<div class="ai-summary-headline">
<span>📋</span> AI Project Summary
</div>
<div class="ai-summary-tag">
{summary_res['stage_case']}
</div>
</div>
<p class="ai-summary-body">
{summary_clean}
</p>
</div>
""")
        st.markdown(summary_html, unsafe_allow_html=True)
        
        # Secondary Insights Cards Section
        if alerts:
            header_html = textwrap.dedent(f"""
<div class="ai-insights-header-text">
<span>{icon}</span> {alerts_title}
</div>
""")
            st.markdown(header_html, unsafe_allow_html=True)
            
            alert_cols = st.columns(len(alerts))
            for i, a in enumerate(alerts):
                with alert_cols[i]:
                    card_html = textwrap.dedent(f"""
<div class="ai-insight-card {card_theme}">
<div class="ai-insight-topic">{a.get('issue')}</div>
<div class="ai-insight-detail"><strong>Details:</strong> {a.get('evidence')}</div>
<div class="ai-insight-detail" style="color:#94a3b8;"><strong>Impact:</strong> {a.get('why_it_matters')}</div>
</div>
""")
                    st.markdown(card_html, unsafe_allow_html=True)
                    
    except Exception as e:
        st.warning(f"Could not load AI Project Summary: {e}")

st.divider()

# --- Check if Project is Completed ---
current = get_current_status(selected_project, df)

if current.get("is_completed", False):
    st.subheader("🏁 Completed Project Summary")
    completed_summary = get_completed_project_summary(selected_project, df)

    c_cols = st.columns(4)
    with c_cols[0]:
        st.metric("Final Physical Progress", f"{completed_summary.get('final_physical_progress_pct', 100.0)}%")
    with c_cols[1]:
        st.metric("Actual Completion Date", completed_summary.get("actual_completion_date", "N/A"))
    with c_cols[2]:
        st.metric("Final Schedule Extension", f"{completed_summary.get('actual_schedule_extension_months', 0.0)} months")
    with c_cols[3]:
        st.metric("Final Cost Overrun", f"{completed_summary.get('actual_cost_overrun_pct', 0.0)}% (₹{completed_summary.get('actual_cost_escalation_crore', 0.0)} Cr)")

    st.info("ℹ️ **Completed Project Outcome**: Future 3-month and 6-month forecasting is discontinued for completed assets. The recorded outcomes above reflect the final reported project metrics.")

else:
    # --- 1. Current Reported Status ---
    st.subheader("📊 1. Current Reported Health (Latest Snapshot)")

    h_cols = st.columns(6)
    with h_cols[0]:
        prog = current.get("physical_progress_pct")
        st.metric("Physical Progress", f"{prog}%" if prog is not None else "N/A")
    with h_cols[1]:
        cost_ov = current.get("cost_overrun_pct")
        cost_cr = current.get("cost_escalation_crore")
        st.metric("Cost Overrun", f"{cost_ov}%" if cost_ov is not None else "N/A",
                  delta=f"₹{cost_cr} Cr" if cost_cr is not None else None)
    with h_cols[2]:
        exp_ratio = current.get("expenditure_ratio_pct")
        st.metric("Expenditure Ratio", f"{exp_ratio}%" if exp_ratio is not None else "N/A")
    with h_cols[3]:
        st.metric("Schedule Status", current.get("schedule_status", "N/A"))
    with h_cols[4]:
        ext = current.get("schedule_extension_months")
        st.metric("Current Extension", f"{ext} months" if ext is not None else "N/A")
    with h_cols[5]:
        rem = current.get("remaining_work_pct")
        st.metric("Remaining Work", f"{rem}%" if rem is not None else "N/A")

    st.divider()

    # --- 2. Predictions ---
    if models is None:
        st.warning("⚠️ Models not loaded. Load models from sidebar to view predictions.")
    else:
        st.subheader("🔮 2. Forecasts (Incremental Changes & Derived Final Totals)")

        try:
            prediction = get_full_prediction(selected_project, df, models)

            tab_cost, tab_sched = st.tabs(["💰 Cost Escalation Forecast", "⏱️ Schedule Delay Forecast"])

            with tab_cost:
                cost_cols = st.columns(2)
                for i, (horizon, pred) in enumerate(prediction.get("cost_prediction", {}).items()):
                    with cost_cols[i % 2]:
                        st.markdown(f"#### **{horizon.replace('_', ' ').title()} Forecast**")

                        prob = pred.get("additional_escalation_probability")
                        if prob is not None:
                            badge = "🟢 LOW RISK" if prob < 0.25 else "🟡 MODERATE RISK" if prob < 0.50 else "🔴 HIGH RISK"
                            st.metric("Probability of Additional Cost Escalation", f"{prob * 100:.1f}%", delta=badge)

                        st.markdown("**Incremental Escalation (Next Period):**")
                        delta_pct = pred.get("predicted_additional_overrun_pct")
                        delta_cr = pred.get("predicted_additional_cost_crore")
                        st.write(f"- Predicted Additional Overrun: **{delta_pct:+.2f}%**")
                        st.write(f"- Predicted Additional Amount: **₹{delta_cr:+,.2f} Cr**")

                        st.markdown("**Forecasted Final Outcome:**")
                        final_pct = pred.get("predicted_final_cost_overrun_pct")
                        final_cr = pred.get("predicted_final_cost_escalation_crore")
                        final_rev = pred.get("predicted_final_revised_cost_crore")
                        st.write(f"- Forecasted Final Cost Overrun: **{final_pct:.2f}%** (₹{final_cr:,.2f} Cr)")
                        st.write(f"- Forecasted Final Revised Cost: **₹{final_rev:,.2f} Cr**")

            with tab_sched:
                timeline = prediction.get("timeline", {}) or get_project_timeline(selected_project, df)
                t_cols = st.columns(2)
                with t_cols[0]:
                    st.metric(
                        "Time Elapsed Till Now",
                        timeline.get("time_elapsed_till_now", "N/A"),
                        help="Calculated from project actual start date up to latest available report date"
                    )
                with t_cols[1]:
                    st.metric(
                        "Time Remaining for Planned Completion",
                        timeline.get("time_remaining_planned_completion", "N/A"),
                        help="Calculated from latest available report date to planned completion date"
                    )

                st.markdown("---")

                # Resolve base dates for timeline calculation
                as_of_date = None
                if timeline.get("as_of_date") and timeline["as_of_date"] != "N/A":
                    as_of_date = pd.to_datetime(timeline["as_of_date"]).date()

                planned_doc_date = None
                if timeline.get("planned_completion_date") and timeline["planned_completion_date"] != "N/A":
                    planned_doc_date = pd.to_datetime(timeline["planned_completion_date"]).date()

                sched_cols = st.columns(2)
                for i, (horizon, pred) in enumerate(prediction.get("time_prediction", {}).items()):
                    with sched_cols[i % 2]:
                        st.markdown(f"#### **{horizon.replace('_', ' ').title()} Forecast**")

                        prob = pred.get("additional_delay_probability")
                        if prob is not None:
                            badge = "🟢 LOW RISK" if prob < 0.25 else "🟡 MODERATE RISK" if prob < 0.50 else "🔴 HIGH RISK"
                            st.metric("Probability of Additional Schedule Delay", f"{prob * 100:.1f}%", delta=badge)

                        st.markdown("**Schedule Delay & Timeline Forecast:**")
                        delta_mo = pred.get("predicted_additional_delay_months")
                        delay_val = float(delta_mo) if delta_mo is not None else 0.0
                        pred_delay_str = f"{delay_val:+.2f} months"

                        # Calculate Tentative Completion Date and Time Needed
                        tentative_date_str = pred.get("tentative_completion_date")
                        time_needed_str = pred.get("estimated_time_needed_completion")

                        if not tentative_date_str or tentative_date_str == "N/A" or not time_needed_str or time_needed_str == "N/A":
                            if as_of_date:
                                base_d = max(planned_doc_date, as_of_date) if planned_doc_date else as_of_date
                                tent_d = add_months_to_date(base_d, delay_val)
                                if tent_d:
                                    tentative_date_str = tent_d.strftime("%d %B %Y")
                                    time_needed_str = format_calendar_duration(as_of_date, tent_d)

                        tot_ext = pred.get("predicted_total_schedule_extension_months")

                        st.write(f"- **Predicted Additional Delay**: `{pred_delay_str}`")
                        st.write(f"- **Estimated Time Needed for Completion**: **{time_needed_str or 'N/A'}**")
                        st.write(f"- **Tentative Completion Date**: **{tentative_date_str or 'N/A'}**")
                        st.write(f"- Forecasted Total Schedule Extension: **{tot_ext:.2f} months**" if tot_ext is not None else "- Forecasted Total Schedule Extension: **N/A**")

            st.divider()

            # --- 3. Explainability (AI Explanations & SHAP) ---
            st.subheader("🔍 3. Explainability — AI Insights & Risk Drivers")

            st.markdown("#### 🤖 AI Natural Language Explanation (Qwen3-8B)")
            exp_tabs = st.tabs(["⏱️ 3M Schedule", "⏱️ 6M Schedule", "💰 3M Cost", "💰 6M Cost"])

            tab_configs = [
                ("schedule", "3_month"),
                ("schedule", "6_month"),
                ("cost", "3_month"),
                ("cost", "6_month"),
            ]

            for tab, (ftype, horizon) in zip(exp_tabs, tab_configs):
                with tab:
                    try:
                        payload = build_explanation_payload(selected_project, df, prediction, ftype, horizon)
                        ai_exp = explainer.generate_explanation(payload)

                        st.info(f"📌 **Summary**: {ai_exp.get('summary', 'No summary available.')}")

                        exp_c1, exp_c2 = st.columns(2)
                        with exp_c1:
                            st.markdown("**Key Contributing Factors ⬆️**")
                            reasons = ai_exp.get("primary_reasons", []) + ai_exp.get("supporting_factors", [])
                            if reasons:
                                for r in reasons:
                                    st.markdown(f"- {r}")
                            else:
                                st.write("No major upward risk contributors identified.")

                        with exp_c2:
                            st.markdown("**Risk-Reducing Factors ⬇️**")
                            prot = ai_exp.get("risk_reducing_factors", [])
                            if prot:
                                for p in prot:
                                    st.markdown(f"- {p}")
                            else:
                                st.write("No major protective factors identified.")

                        st.caption(f"ℹ️ Explanation Source: `{ai_exp.get('provider', 'AI Engine')}`")
                    except Exception as e:
                        st.warning(f"Could not generate explanation for this tab: {e}")

            # Technical Raw SHAP Inspection
            with st.expander("📊 Technical SHAP Feature Attributions (Raw TreeExplainer Values)"):
                explanations = prediction.get("explanations", {})
                if explanations:
                    tech_tabs = st.tabs(list(explanations.keys()))
                    for t_tab, (model_name, explanation) in zip(tech_tabs, explanations.items()):
                        with t_tab:
                            risk_col, protect_col = st.columns(2)
                            with risk_col:
                                st.markdown("**Top Escalation Risk Drivers** ⬆️")
                                for driver in explanation.get("top_risk_drivers", [])[:7]:
                                    feat = driver["feature"]
                                    val = driver["shap_value"]
                                    st.text(f"{feat[:35]:<35} {val:+.4f}")

                            with protect_col:
                                st.markdown("**Protective Factors** ⬇️")
                                for driver in explanation.get("top_protective_factors", [])[:7]:
                                    feat = driver["feature"]
                                    val = driver["shap_value"]
                                    st.text(f"{feat[:35]:<35} {val:+.4f}")

            # --- Interactive Project Q&A Assistant ---
            st.markdown("---")
            st.markdown("#### 💬 Interactive Project AI Assistant")
            st.caption("Ask grounded questions about this project's predictions, risk drivers, or completion forecasts.")

            chat_key = f"chat_history_{selected_project}"
            if chat_key not in st.session_state:
                st.session_state[chat_key] = []

            chat_ctx = build_project_chat_context(selected_project, df, prediction)

            prompt_cols = st.columns(5)
            quick_prompts = [
                "Why is this project at high risk?",
                "What is the biggest factor affecting the prediction?",
                "Which factors are reducing the risk?",
                "Why is the 6-month forecast different from 3-month?",
                "Explain the cost forecast."
            ]
            selected_quick_prompt = None
            for i, qp in enumerate(quick_prompts):
                with prompt_cols[i]:
                    if st.button(qp, key=f"qp_{selected_project}_{i}", use_container_width=True):
                        selected_quick_prompt = qp

            user_query = st.chat_input("Ask a question about this project's predictions...")
            active_query = selected_quick_prompt or user_query

            if active_query:
                st.session_state[chat_key].append({"role": "user", "content": active_query})
                with st.spinner("Analyzing project evidence..."):
                    ans = explainer.answer_question(chat_ctx, active_query, st.session_state[chat_key][:-1])
                    st.session_state[chat_key].append({"role": "assistant", "content": ans})

            for msg in st.session_state[chat_key]:
                with st.chat_message(msg["role"]):
                    st.markdown(msg["content"])

        except Exception as e:
            st.error(f"Prediction error: {e}")
            import traceback
            st.text(traceback.format_exc())

st.divider()

# --- 4. Historical Trajectory Timeline ---
st.subheader("📈 4. Historical Trajectory Timeline")
try:
    history = load_project_history(selected_project, df)

    display_cols = [
        "report_month", "physical_progress_pct", "cost_overrun_pct",
        "expenditure_ratio_pct", "cost_escalation_crore", "schedule_extension_months", "schedule_status",
    ]
    available_cols = [c for c in display_cols if c in history.columns]
    timeline_df = history[available_cols].copy()

    if "report_month" in timeline_df.columns:
        timeline_df["report_month"] = timeline_df["report_month"].dt.strftime("%Y-%m")

    st.dataframe(timeline_df, use_container_width=True, hide_index=True)

    # Plotly Trend Chart
    fig = go.Figure()
    if "physical_progress_pct" in history.columns:
        fig.add_trace(go.Scatter(x=history["report_month"], y=history["physical_progress_pct"], mode="lines+markers", name="Physical Progress (%)"))
    if "expenditure_ratio_pct" in history.columns:
        fig.add_trace(go.Scatter(x=history["report_month"], y=history["expenditure_ratio_pct"], mode="lines+markers", name="Expenditure Ratio (%)"))
    if "cost_overrun_pct" in history.columns:
        fig.add_trace(go.Scatter(x=history["report_month"], y=history["cost_overrun_pct"], mode="lines+markers", name="Cost Overrun (%)"))

    fig.update_layout(
        title="Physical Progress vs Expenditure vs Cost Overrun",
        xaxis_title="Report Month",
        yaxis_title="Percentage (%)",
        height=380,
        template="plotly_white",
    )
    st.plotly_chart(fig, use_container_width=True)

except Exception as e:
    st.error(f"Error loading history: {e}")
