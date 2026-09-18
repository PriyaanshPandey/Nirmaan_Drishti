import json
import re

with open('frontend/src/data/projectsData.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# find array
start = content.find('export const projectsData: Project[] = [')
if start != -1:
    array_str = content[start + len('export const projectsData: Project[] = '):].strip()
    if array_str.endswith(';'):
        array_str = array_str[:-1].strip()
    data = json.loads(array_str)
    print(f"Total projects in projectsData: {len(data)}")
    
    tot_orig = 0.0
    tot_rev = 0.0
    tot_exp = 0.0
    
    delays = {'On Track': 0, 'Needs Attention': 0, 'High Risk': 0, 'Critical Delay': 0}
    risks = {'High Risk / Critical': 0, 'Medium Risk': 0, 'Low Risk': 0}
    
    for p in data:
        orig = float(p.get('costApproved', '0').replace('₹', '').replace(' Cr', '').replace(',', '').strip() or 0)
        rev = float(p.get('costRevised', '0').replace('₹', '').replace(' Cr', '').replace(',', '').strip() or 0)
        exp = float(p.get('costExpenditure', '0').replace('₹', '').replace(' Cr', '').replace(',', '').strip() or 0)
        tot_orig += orig
        tot_rev += rev
        tot_exp += exp
        
        # Risk level
        rl = p.get('riskLevel')
        rs = p.get('riskScore', 0)
        if rl in ['Critical', 'High'] or rs >= 70:
            risks['High Risk / Critical'] += 1
        elif rl == 'Medium' or rs >= 45:
            risks['Medium Risk'] += 1
        else:
            risks['Low Risk'] += 1
            
        # Delay / Schedule Status
        stat = (p.get('scheduleStatus') or '').upper()
        ext = float(p.get('scheduleExtensionMonths') or 0)
        days = float(p.get('delayDays') or 0)
        
        if 'CRIT' in stat or days > 730 or ext > 36 or rs >= 80:
            delays['Critical Delay'] += 1
        elif 'DELAY' in stat or ext > 6 or days > 180 or rs >= 65:
            delays['High Risk'] += 1
        elif ext > 0 or days > 0 or stat in ['IN REVIEW', 'IN PROGRESS']:
            delays['Needs Attention'] += 1
        else:
            delays['On Track'] += 1

    print(f"Total Orig Cost: Rs {tot_orig/100000:.2f} L Cr")
    print(f"Total Rev Cost: Rs {tot_rev/100000:.2f} L Cr")
    if tot_orig > 0:
        print(f"Overrun: +{(tot_rev - tot_orig)/tot_orig*100:.1f}%")
    print("Delays:", delays)
    print("Risks:", risks)
