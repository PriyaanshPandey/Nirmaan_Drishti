# MoSPI Universal Flash Report Extractor & Master Dataset Harmonizer Suite

Autonomous deterministic parsing engine for Government of India (MoSPI) infrastructure flash reports (2001 - 2027+).
Harmonizes monthly reports with `Features.csv`, heals legacy value shifts, and strictly enforces the **May 2026 pre-trained AI model cutoff**.

## Quick Start

### 1-Click Launch (Windows)
Double-click `run_extractor.bat` in this folder. It will install dependencies and launch the suite on `http://localhost:8000`.

### Manual Launch
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app:app --host 127.0.0.1 --port 8000
```
Then open `http://localhost:8000` in your web browser.
