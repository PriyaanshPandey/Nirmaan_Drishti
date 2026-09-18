@echo off
title MoSPI Universal Flash Report Extractor & Dataset Harmonizer
echo =========================================================================
echo Starting MoSPI Universal Flash Report Extractor Suite (Port 8000)...
echo =========================================================================

cd backend
python -m pip install -r requirements.txt
start http://localhost:8000
python -m uvicorn app:app --host 127.0.0.1 --port 8000

pause
