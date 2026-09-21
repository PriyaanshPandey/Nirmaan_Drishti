import React, { createContext, useContext, useState } from 'react';

export type Language = 'en' | 'hi';

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
  t: (key: string, defaultText?: string) => string;
}

const translations: Record<string, Record<Language, string>> = {
  // ═══════════════════════════════════════════════════════════
  //  BRAND & GOVERNMENT IDENTITY
  // ═══════════════════════════════════════════════════════════
  'portal_title': { en: 'Nirmaan Drishti', hi: 'निर्माण दृष्टि' },
  'portal_subtitle': { en: 'PAIMANA National Infrastructure Intelligence Portal', hi: 'पैमाना राष्ट्रीय बुनियादी ढांचा बुद्धिमत्ता पोर्टल' },
  'mospi_title': { en: 'Ministry of Statistics & Programme Implementation', hi: 'सांख्यिकी एवं कार्यक्रम कार्यान्वयन मंत्रालय' },
  'goi_title': { en: 'Government of India', hi: 'भारत सरकार' },
  'mospi_hindi': { en: 'सांख्यिकी और कार्यक्रम कार्यान्वयन मंत्रालय', hi: 'सांख्यिकी और कार्यक्रम कार्यान्वयन मंत्रालय' },
  'nirmaan_drishti': { en: 'Nirmaan Drishti', hi: 'निर्माण दृष्टि' },
  'paimana_subtitle': { en: 'PAIMANA · Predictive Monitoring', hi: 'पैमाना · भविष्यसूचक निगरानी' },

  // ═══════════════════════════════════════════════════════════
  //  NAVIGATION
  // ═══════════════════════════════════════════════════════════
  'nav_home': { en: 'Home', hi: 'मुख्य पृष्ठ' },
  'nav_dashboard': { en: 'Dashboard', hi: 'डैशबोर्ड' },
  'nav_projects': { en: 'Projects', hi: 'परियोजनाएं' },
  'nav_benchmark': { en: 'Benchmark', hi: 'मानदंड' },
  'nav_alerts': { en: 'Alerts', hi: 'चेतावनी' },
  'nav_actions': { en: 'Action Center', hi: 'कार्रवाई केंद्र' },
  'nav_extractor': { en: 'PDF Extractor', hi: 'पीडीएफ निष्कर्षण' },

  // ═══════════════════════════════════════════════════════════
  //  HEADER & ACCESSIBILITY
  // ═══════════════════════════════════════════════════════════
  'search_projects': { en: 'Search Projects', hi: 'परियोजना खोजें' },
  'screen_reader': { en: 'Screen Reader Access', hi: 'स्क्रीन रीडर' },
  'accessibility': { en: 'Accessibility Tools', hi: 'अभिगम्यता उपकरण' },
  'dark_contrast': { en: 'Dark Contrast', hi: 'गहरा कंट्रास्ट' },
  'invert_colors': { en: 'Invert', hi: 'रंग उलटें' },
  'text_increase': { en: 'Text Size Increase', hi: 'पाठ आकार बढ़ाएं' },
  'text_decrease': { en: 'Text Size Decrease', hi: 'पाठ आकार घटाएं' },
  'highlight_links': { en: 'Highlight Links', hi: 'लिंक हाइलाइट करें' },
  'reset_all': { en: 'Reset All', hi: 'सभी रीसेट करें' },
  'officer_sign_in': { en: 'Officer Sign In', hi: 'अधिकारी लॉगिन' },
  'sign_out': { en: 'Sign Out', hi: 'लॉग आउट' },
  'switch_to_hindi': { en: 'हिंदी', hi: 'English' },

  // ═══════════════════════════════════════════════════════════
  //  STATUS & RISK LABELS
  // ═══════════════════════════════════════════════════════════
  'status_on_track': { en: 'On Track', hi: 'समय पर' },
  'status_in_progress': { en: 'In Progress', hi: 'प्रगति पर' },
  'status_delayed': { en: 'Delayed', hi: 'विलंबित' },
  'status_critical': { en: 'Critical', hi: 'गंभीर' },
  'status_low_risk': { en: 'Low Risk', hi: 'कम जोखिम' },
  'status_medium_risk': { en: 'Medium Risk', hi: 'मध्यम जोखिम' },
  'status_high_risk': { en: 'High Risk', hi: 'उच्च जोखिम' },
  'status_critical_risk': { en: 'Critical Risk', hi: 'गंभीर जोखिम' },
  'status_ongoing': { en: 'Ongoing Projects', hi: 'चल रही परियोजनाएं' },
  'status_inactive': { en: 'Inactive Projects', hi: 'निष्क्रिय परियोजनाएं' },
  'status_completed': { en: 'Completed Projects', hi: 'पूर्ण परियोजनाएं' },

  // ═══════════════════════════════════════════════════════════
  //  HOME PAGE
  // ═══════════════════════════════════════════════════════════
  'hero_title': { en: 'AI-Powered Infrastructure Monitoring & Early Warning System', hi: 'एआई-संचालित बुनियादी ढांचा निगरानी एवं प्रारंभिक चेतावनी प्रणाली' },
  'hero_subtitle': { en: 'Real-time telemetry tracking 1,981 central infrastructure projects across 28 states', hi: '28 राज्यों में 1,981 केंद्रीय बुनियादी ढांचा परियोजनाओं की वास्तविक समय निगरानी' },
  'explore_dashboard': { en: 'Explore Dashboard', hi: 'डैशबोर्ड देखें' },
  'view_projects': { en: 'View All Projects', hi: 'सभी परियोजनाएं देखें' },
  'total_projects_monitored': { en: 'Total Projects Monitored', hi: 'कुल निगरानी परियोजनाएं' },
  'portfolio_value': { en: 'Portfolio Value', hi: 'पोर्टफोलियो मूल्य' },
  'lakh_crore': { en: 'Lakh Crore', hi: 'लाख करोड़' },
  'state_wise_title': { en: 'State-wise Infrastructure Projects', hi: 'राज्यवार बुनियादी ढांचा परियोजनाएं' },
  'platform_modules': { en: 'Platform Modules', hi: 'पोर्टल मॉड्यूल' },
  'module_dashboard_title': { en: 'Real-Time Dashboard', hi: 'वास्तविक समय डैशबोर्ड' },
  'module_dashboard_desc': { en: 'Live national risk telemetry with AI-powered forecasts and trend analysis', hi: 'एआई-संचालित पूर्वानुमान और प्रवृत्ति विश्लेषण के साथ लाइव राष्ट्रीय जोखिम टेलीमेट्री' },
  'module_projects_title': { en: 'Project Intelligence', hi: 'परियोजना बुद्धिमत्ता' },
  'module_projects_desc': { en: 'Deep-dive into individual project health, SHAP attributions, and ML forecasts', hi: 'व्यक्तिगत परियोजना स्वास्थ्य, SHAP विश्लेषण और ML पूर्वानुमानों में गहन अध्ययन' },
  'module_benchmark_title': { en: 'Benchmark Analytics', hi: 'मानदंड विश्लेषिकी' },
  'module_benchmark_desc': { en: 'Ministry-wise and sector-wise distribution, risk comparison matrix', hi: 'मंत्रालय-वार और क्षेत्र-वार वितरण, जोखिम तुलना मैट्रिक्स' },
  'module_alerts_title': { en: 'Early Warnings & Alerts', hi: 'प्रारंभिक चेतावनी एवं अलर्ट' },
  'module_alerts_desc': { en: 'Real-time early warning signals for cost and schedule overruns', hi: 'लागत और समय सीमा विस्तार के लिए वास्तविक समय प्रारंभिक चेतावनी संकेत' },
  'historical_timeline': { en: 'Historical Project Timeline & Trajectory', hi: 'ऐतिहासिक परियोजना समयरेख एवं प्रगति पथ' },

  // ═══════════════════════════════════════════════════════════
  //  DASHBOARD & METRICS
  // ═══════════════════════════════════════════════════════════
  'national_risk_score': { en: 'National Risk Score', hi: 'राष्ट्रीय जोखिम स्कोर' },
  'project_health': { en: 'Project Health Index', hi: 'परियोजना स्वास्थ्य सूचकांक' },
  'cost_overrun': { en: 'Cost Overrun', hi: 'लागत वृद्धि' },
  'cost_overrun_forecast': { en: 'Cost Overrun Forecast', hi: 'लागत वृद्धि पूर्वानुमान' },
  'schedule_overrun': { en: 'Schedule Overrun', hi: 'समय सीमा विस्तार' },
  'schedule_overrun_forecast': { en: 'Schedule Overrun Forecast', hi: 'समय सीमा विस्तार पूर्वानुमान' },
  'risk_score': { en: 'Risk Score', hi: 'जोखिम स्कोर' },
  'risk_index': { en: 'Risk Index', hi: 'जोखिम सूचकांक' },
  'total_projects': { en: 'Total Projects', hi: 'कुल परियोजनाएं' },
  'ongoing_projects': { en: 'Ongoing Projects', hi: 'चल रही परियोजनाएं' },
  'avg_cost_overrun': { en: 'Average Cost Overrun', hi: 'औसत लागत वृद्धि' },
  'avg_schedule_delay': { en: 'Average Schedule Delay', hi: 'औसत समय विलंब' },
  'avg_risk': { en: 'Average Risk', hi: 'औसत जोखिम' },
  'total_cost_approved': { en: 'Total Cost Approved', hi: 'कुल स्वीकृत लागत' },
  'total_cost_revised': { en: 'Total Cost Revised', hi: 'कुल संशोधित लागत' },
  'cost_escalation': { en: 'Cost Escalation', hi: 'लागत में वृद्धि' },
  'physical_progress': { en: 'Physical Progress', hi: 'भौतिक प्रगति' },
  'financial_progress': { en: 'Financial Progress', hi: 'वित्तीय प्रगति' },
  'expenditure': { en: 'Expenditure', hi: 'व्यय' },
  'months': { en: 'months', hi: 'महीने' },
  'crore': { en: 'Crore', hi: 'करोड़' },

  // ═══════════════════════════════════════════════════════════
  //  PROJECT PORTFOLIO TABLE
  // ═══════════════════════════════════════════════════════════
  'search_placeholder': { en: 'Search projects by name, sector, ministry, or ID...', hi: 'नाम, क्षेत्र, मंत्रालय, या आईडी द्वारा परियोजना खोजें...' },
  'filter_all': { en: 'All', hi: 'सभी' },
  'filter_ministry': { en: 'Ministry', hi: 'मंत्रालय' },
  'filter_sector': { en: 'Sector', hi: 'क्षेत्र' },
  'filter_state': { en: 'State', hi: 'राज्य' },
  'filter_agency': { en: 'Agency', hi: 'एजेंसी' },
  'filter_risk': { en: 'Risk Level', hi: 'जोखिम स्तर' },
  'filter_status': { en: 'Status', hi: 'स्थिति' },
  'all_ministries': { en: 'All Ministries', hi: 'सभी मंत्रालय' },
  'all_sectors': { en: 'All Sectors', hi: 'सभी क्षेत्र' },
  'all_states': { en: 'All States', hi: 'सभी राज्य' },
  'all_agencies': { en: 'All Agencies', hi: 'सभी एजेंसियां' },
  'col_project_name': { en: 'Project Name', hi: 'परियोजना का नाम' },
  'col_ministry': { en: 'Ministry', hi: 'मंत्रालय' },
  'col_sector': { en: 'Sector', hi: 'क्षेत्र' },
  'col_state': { en: 'State / Location', hi: 'राज्य / स्थान' },
  'col_cost_approved': { en: 'Cost Approved', hi: 'स्वीकृत लागत' },
  'col_cost_revised': { en: 'Cost Revised', hi: 'संशोधित लागत' },
  'col_cost_overrun_pct': { en: 'Cost Overrun %', hi: 'लागत वृद्धि %' },
  'col_delay_months': { en: 'Delay (Months)', hi: 'विलंब (महीने)' },
  'col_risk': { en: 'Risk', hi: 'जोखिम' },
  'col_progress': { en: 'Progress', hi: 'प्रगति' },
  'col_actions': { en: 'Actions', hi: 'कार्रवाई' },
  'view_details': { en: 'View Details', hi: 'विवरण देखें' },
  'take_action': { en: 'Take Action', hi: 'कार्रवाई करें' },
  'showing_projects': { en: 'Showing', hi: 'दिखा रहे' },
  'of_total': { en: 'of', hi: 'कुल में से' },
  'projects': { en: 'projects', hi: 'परियोजनाएं' },
  'no_projects_found': { en: 'No projects found matching your criteria.', hi: 'आपके मानदंडों से मेल खाती कोई परियोजना नहीं मिली।' },
  'clear_filters': { en: 'Clear Filters', hi: 'फ़िल्टर साफ़ करें' },
  'rows_per_page': { en: 'Rows per page', hi: 'प्रति पृष्ठ पंक्तियां' },
  'page': { en: 'Page', hi: 'पृष्ठ' },

  // ═══════════════════════════════════════════════════════════
  //  PROJECT DETAILS
  // ═══════════════════════════════════════════════════════════
  'sec_basic': { en: 'Basic Information', hi: 'मूल जानकारी' },
  'sec_forecasts': { en: 'Forecasts', hi: 'पूर्वानुमान' },
  'sec_escalation': { en: 'Escalation Drivers', hi: 'वृद्धि कारक' },
  'sec_warnings': { en: 'Warnings', hi: 'चेतावनियां' },
  'project_overview': { en: 'Project Overview', hi: 'परियोजना अवलोकन' },
  'implementing_agency': { en: 'Implementing Agency', hi: 'कार्यान्वयन एजेंसी' },
  'approval_date': { en: 'Approval Date', hi: 'अनुमोदन तिथि' },
  'completion_date': { en: 'Completion Date', hi: 'पूर्णता तिथि' },
  'revised_completion': { en: 'Revised Completion', hi: 'संशोधित पूर्णता' },
  'original_cost': { en: 'Original Cost', hi: 'मूल लागत' },
  'revised_cost': { en: 'Revised Cost', hi: 'संशोधित लागत' },
  'expenditure_to_date': { en: 'Expenditure to Date', hi: 'अब तक का व्यय' },
  'monthly_expenditure': { en: 'Monthly Expenditure', hi: 'मासिक व्यय' },
  'delay_months': { en: 'Delay Months', hi: 'विलंब महीने' },
  'risk_level': { en: 'Risk Level', hi: 'जोखिम स्तर' },
  'schedule_status': { en: 'Schedule Status', hi: 'अनुसूची स्थिति' },
  'cost_overrun_pct': { en: 'Cost Overrun %', hi: 'लागत वृद्धि %' },
  'ai_cost_forecast': { en: 'AI Cost Overrun Forecast', hi: 'एआई लागत वृद्धि पूर्वानुमान' },
  'ai_schedule_forecast': { en: 'AI Schedule Delay Forecast', hi: 'एआई समय विलंब पूर्वानुमान' },
  'probability': { en: 'Probability', hi: 'संभावना' },
  'confidence': { en: 'Confidence', hi: 'विश्वास' },
  'shap_analysis': { en: 'SHAP Feature Attribution', hi: 'SHAP विशेषता विश्लेषण' },
  'top_drivers': { en: 'Top Escalation Drivers', hi: 'शीर्ष वृद्धि कारक' },
  'nlp_insights': { en: 'NLP Root Cause Insights', hi: 'एनएलपी मूल कारण अंतर्दृष्टि' },
  'back_to_projects': { en: 'Back to Projects', hi: 'परियोजनाओं पर वापस' },

  // ═══════════════════════════════════════════════════════════
  //  ALERTS PAGE
  // ═══════════════════════════════════════════════════════════
  'early_warnings': { en: 'Early Warning Signals', hi: 'प्रारंभिक चेतावनी संकेत' },
  'tickets': { en: 'Action Tickets', hi: 'कार्रवाई टिकट' },
  'warning_signals': { en: 'Warning Signals', hi: 'चेतावनी संकेत' },
  'ticket_board': { en: 'Action Ticket Board', hi: 'कार्रवाई टिकट बोर्ड' },
  'total_warnings': { en: 'Total Warnings', hi: 'कुल चेतावनियां' },
  'active_tickets': { en: 'Active Tickets', hi: 'सक्रिय टिकट' },
  'ticket_id': { en: 'Ticket ID', hi: 'टिकट आईडी' },
  'assigned_officer': { en: 'Assigned Officer', hi: 'नियुक्त अधिकारी' },
  'date_issued': { en: 'Date Issued', hi: 'जारी करने की तिथि' },
  'priority': { en: 'Priority', hi: 'प्राथमिकता' },
  'ticket_status': { en: 'Ticket Status', hi: 'टिकट स्थिति' },
  'open': { en: 'Open', hi: 'खुला' },
  'pending': { en: 'Pending', hi: 'लंबित' },
  'in_progress': { en: 'In Progress', hi: 'प्रगति पर' },
  'resolved': { en: 'Resolved', hi: 'हल किया गया' },
  'search_tickets': { en: 'Search tickets...', hi: 'टिकट खोजें...' },
  'filter_by_status': { en: 'Filter by Status', hi: 'स्थिति द्वारा फ़िल्टर करें' },
  'all_tickets': { en: 'All Tickets', hi: 'सभी टिकट' },
  'no_tickets_found': { en: 'No Officer Action Tickets Found', hi: 'कोई अधिकारी कार्रवाई टिकट नहीं मिला' },
  'project_reference': { en: 'PROJECT REFERENCE', hi: 'परियोजना संदर्भ' },

  // ═══════════════════════════════════════════════════════════
  //  ACTION CENTER
  // ═══════════════════════════════════════════════════════════
  'sec_recommended': { en: 'Recommended Interventions & Fast-Track Actions', hi: 'अनुशंसित हस्तक्षेप एवं त्वरित कार्रवाई' },
  'sec_simulator': { en: 'What-If Counterfactual Policy Simulator', hi: 'काल्पनिक नीति सिम्युलेटर' },
  'sec_routing': { en: 'Policy-Aware Authority Routing Matrix', hi: 'नीति-जागरूक प्राधिकरण मार्ग मैट्रिक्स' },
  'generate_ticket': { en: 'Generate Ticket (PDF)', hi: 'टिकट बनाएं (PDF)' },
  'generate_memo': { en: 'Generate Memo (PDF)', hi: 'ज्ञापन बनाएं (PDF)' },
  'assign_to': { en: 'Assign Ticket To', hi: 'टिकट किसको दें' },
  'run_simulation': { en: 'Run Simulation', hi: 'सिम्युलेशन चलाएं' },
  'reset': { en: 'Reset', hi: 'रीसेट करें' },
  'additional_cost': { en: 'Additional Cost (Capital Outlay)', hi: 'अतिरिक्त लागत (पूंजी परिव्यय)' },
  'additional_time': { en: 'Additional Time Delay', hi: 'अतिरिक्त समय विलंब' },
  'monthly_exp': { en: 'Monthly Expenditure Override', hi: 'मासिक व्यय समायोजन' },
  'baseline': { en: 'Baseline', hi: 'आधारभूत' },
  'scenario': { en: 'Scenario', hi: 'परिदृश्य' },
  'change': { en: 'Change', hi: 'परिवर्तन' },
  'active_targets': { en: 'Active Targets Identified', hi: 'सक्रिय लक्ष्य चिन्हित' },
  'action_centre_targets': { en: 'Action Centre Targets', hi: 'कार्रवाई केंद्र लक्ष्य' },
  'top_5': { en: 'Top 5', hi: 'शीर्ष 5' },
  'top_10': { en: 'Top 10', hi: 'शीर्ष 10' },
  'all_projects': { en: 'All Projects', hi: 'सभी परियोजनाएं' },
  'inspect': { en: 'Inspect', hi: 'निरीक्षण' },
  'cost_overrun_label': { en: 'COST OVERRUN', hi: 'लागत वृद्धि' },
  'schedule_slippage': { en: 'SCHEDULE SLIPPAGE', hi: 'अनुसूची विचलन' },
  'why_these_actions': { en: 'Why these actions?', hi: 'ये कार्रवाई क्यों?' },

  // ═══════════════════════════════════════════════════════════
  //  DISTRIBUTION / BENCHMARK
  // ═══════════════════════════════════════════════════════════
  'health_risk_breakdown': { en: 'Health & Risk Breakdown', hi: 'स्वास्थ्य एवं जोखिम विश्लेषण' },
  'priority_interventions': { en: 'Priority Interventions', hi: 'प्राथमिकता हस्तक्षेप' },
  'benchmark_analytics': { en: 'Benchmark Analytics', hi: 'मानदंड विश्लेषिकी' },
  'ministry_wise': { en: 'Ministry-wise Distribution', hi: 'मंत्रालय-वार वितरण' },
  'sector_wise': { en: 'Sector-wise Distribution', hi: 'क्षेत्र-वार वितरण' },
  'project_health_status': { en: 'Project Health Status Distribution', hi: 'परियोजना स्वास्थ्य स्थिति वितरण' },
  'risk_index_breakdown': { en: 'ML Composite Risk Index Breakdown', hi: 'ML समग्र जोखिम सूचकांक विश्लेषण' },
  'head_to_head': { en: 'Head-to-Head Comparison', hi: 'आमने-सामने तुलना' },

  // ═══════════════════════════════════════════════════════════
  //  PDF EXTRACTOR
  // ═══════════════════════════════════════════════════════════
  'extractor_title': { en: 'MoSPI PDF Extractor', hi: 'MoSPI पीडीएफ निष्कर्षण' },
  'upload_pdf': { en: 'Upload PDF', hi: 'पीडीएफ अपलोड करें' },
  'extract_data': { en: 'Extract Data', hi: 'डेटा निकालें' },
  'processing': { en: 'Processing...', hi: 'प्रक्रिया हो रही है...' },
  'download_csv': { en: 'Download CSV', hi: 'CSV डाउनलोड करें' },
  'extracted_fields': { en: 'Extracted Fields', hi: 'निकाले गए फ़ील्ड' },

  // ═══════════════════════════════════════════════════════════
  //  INDIA MAP
  // ═══════════════════════════════════════════════════════════
  'map_title': { en: 'National Infrastructure Map', hi: 'राष्ट्रीय बुनियादी ढांचा मानचित्र' },
  'click_state': { en: 'Click a state to view projects', hi: 'परियोजनाएं देखने के लिए राज्य पर क्लिक करें' },
  'total_cost': { en: 'Total Cost', hi: 'कुल लागत' },

  // ═══════════════════════════════════════════════════════════
  //  LOGIN PAGE
  // ═══════════════════════════════════════════════════════════
  'login_title': { en: 'Official Portal Access', hi: 'आधिकारिक पोर्टल प्रवेश' },
  'login_subtitle': { en: 'Secure authentication for authorized IMPD & MoSPI officers', hi: 'अधिकृत IMPD और MoSPI अधिकारियों के लिए सुरक्षित प्रमाणीकरण' },
  'username': { en: 'Username / Officer ID', hi: 'उपयोगकर्ता नाम / अधिकारी आईडी' },
  'password': { en: 'Password', hi: 'पासवर्ड' },
  'sign_in': { en: 'Sign In', hi: 'लॉगिन करें' },
  'demo_credentials': { en: 'Demo Credentials', hi: 'डेमो प्रमाणपत्र' },
  'continue_public': { en: 'Continue as Public User', hi: 'सार्वजनिक उपयोगकर्ता के रूप में जारी रखें' },

  // ═══════════════════════════════════════════════════════════
  //  GLOBAL OVERRUN GRAPHS
  // ═══════════════════════════════════════════════════════════
  'cost_overrun_trend': { en: 'Cost Overrun Trend', hi: 'लागत वृद्धि प्रवृत्ति' },
  'schedule_overrun_trend': { en: 'Schedule Overrun Trend', hi: 'समय वृद्धि प्रवृत्ति' },
  'national_cost_trend': { en: 'National Cost Overrun Trend', hi: 'राष्ट्रीय लागत वृद्धि प्रवृत्ति' },
  'national_schedule_trend': { en: 'National Schedule Overrun Trend', hi: 'राष्ट्रीय समय वृद्धि प्रवृत्ति' },

  // ═══════════════════════════════════════════════════════════
  //  FOOTER
  // ═══════════════════════════════════════════════════════════
  'footer_about': { en: 'About', hi: 'हमारे बारे में' },
  'footer_about_text': { en: 'Nirmaan Drishti is the AI-powered national infrastructure monitoring portal under the Ministry of Statistics & Programme Implementation (MoSPI), Government of India.', hi: 'निर्माण दृष्टि, सांख्यिकी एवं कार्यक्रम कार्यान्वयन मंत्रालय (MoSPI), भारत सरकार के तहत एआई-संचालित राष्ट्रीय बुनियादी ढांचा निगरानी पोर्टल है।' },
  'footer_quick_links': { en: 'Quick Links', hi: 'त्वरित लिंक' },
  'footer_important_links': { en: 'Important Links', hi: 'महत्वपूर्ण लिंक' },
  'footer_contact': { en: 'Contact Us', hi: 'संपर्क करें' },
  'footer_address': { en: 'Madan Mohan Malaviya University of Technology, Gorakhpur', hi: 'मदन मोहन मालवीय प्रौद्योगिकी विश्वविद्यालय, गोरखपुर' },
  'footer_copyright': { en: 'Copyright © 2026 Team NavDrishti. All Rights Reserved.', hi: 'कॉपीराइट © 2026 टीम नवदृष्टि। सर्वाधिकार सुरक्षित।' },
  'footer_designed_by': { en: 'Designed & Developed by Team NavDrishti', hi: 'टीम नवदृष्टि द्वारा डिज़ाइन एवं विकसित' },
  'footer_content_managed': { en: 'Content managed by MoSPI, Government of India', hi: 'सामग्री प्रबंधन: MoSPI, भारत सरकार' },
  'india_gov': { en: 'National Portal of India', hi: 'भारत का राष्ट्रीय पोर्टल' },
  'pib': { en: 'Press Information Bureau', hi: 'पत्र सूचना कार्यालय' },
  'mospi_portal': { en: 'MoSPI Official Portal', hi: 'MoSPI आधिकारिक पोर्टल' },
  'niti_aayog': { en: 'NITI Aayog', hi: 'नीति आयोग' },

  // ═══════════════════════════════════════════════════════════
  //  COMMON / SHARED
  // ═══════════════════════════════════════════════════════════
  'loading': { en: 'Loading...', hi: 'लोड हो रहा है...' },
  'error': { en: 'Error', hi: 'त्रुटि' },
  'close': { en: 'Close', hi: 'बंद करें' },
  'save': { en: 'Save', hi: 'सहेजें' },
  'cancel': { en: 'Cancel', hi: 'रद्द करें' },
  'confirm': { en: 'Confirm', hi: 'पुष्टि करें' },
  'download': { en: 'Download', hi: 'डाउनलोड' },
  'export': { en: 'Export', hi: 'निर्यात' },
  'search': { en: 'Search', hi: 'खोजें' },
  'next': { en: 'Next', hi: 'अगला' },
  'previous': { en: 'Previous', hi: 'पिछला' },
  'yes': { en: 'Yes', hi: 'हाँ' },
  'no': { en: 'No', hi: 'नहीं' },
  'of': { en: 'of', hi: 'का' },
  'and': { en: 'and', hi: 'और' },
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  const toggleLanguage = () => {
    setLanguage(prev => (prev === 'en' ? 'hi' : 'en'));
  };

  const t = (key: string, defaultText?: string): string => {
    if (translations[key] && translations[key][language]) {
      return translations[key][language];
    }
    return defaultText || key;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      language: 'en',
      toggleLanguage: () => {},
      setLanguage: () => {},
      t: (key: string, defaultText?: string) => defaultText || key,
    };
  }
  return ctx;
};
