import json

with open('frontend/src/data/projectsData.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = 0
for i, line in enumerate(lines):
    if 'export const projectsData' in line:
        start_idx = i
        break

ts_code = "".join(lines[start_idx:])
json_str = ts_code.split('=', 1)[1].strip().rstrip(';')
data = json.loads(json_str)

# Check risk scores distribution among ON TRACK and DELAYED
scores = [p.get('riskScore', 0) for p in data]
from collections import Counter
print('Min score:', min(scores), 'Max score:', max(scores))
print('Risk score percentiles:')
import statistics
print('Mean:', statistics.mean(scores), 'Median:', statistics.median(scores))

on_track_scores = [p.get('riskScore', 0) for p in data if p.get('scheduleStatus') == 'ON TRACK']
print('ON TRACK mean score:', statistics.mean(on_track_scores), 'median:', statistics.median(on_track_scores))

# Let's see counts for:
# Critical: riskLevel == 'Critical' or riskScore >= 75 or scheduleStatus == 'CRITICAL'
# Delayed: scheduleStatus == 'DELAYED' and not critical
# In Review: ?
# On Track: ?
crit = [p for p in data if p.get('scheduleStatus') == 'CRITICAL' or p.get('riskLevel') == 'Critical' or p.get('riskScore', 0) >= 75]
del_p = [p for p in data if p not in crit and p.get('scheduleStatus') == 'DELAYED']
rem = [p for p in data if p not in crit and p not in del_p]

print(f"Crit: {len(crit)}, Delayed: {len(del_p)}, Remainder (all ON TRACK): {len(rem)}")
# Inside rem:
med = [p for p in rem if p.get('riskLevel') == 'Medium' or p.get('riskScore', 0) >= 25]
print("Inside remainder, riskLevel==Medium or riskScore >= 25:", len(med))
med_in_prog = [p for p in rem if 0 < p.get('progressPhysical', 0) < 100 and (p.get('riskLevel') == 'Medium' or p.get('riskScore', 0) >= 25)]
print("Inside remainder, physical progress 0-100 and risk >= 25:", len(med_in_prog))
