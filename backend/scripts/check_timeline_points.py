import requests

res = requests.get('http://127.0.0.1:8000/api/projects/400259/timeline').json()
pts = res.get('timeline', [])
print(f"Total points: {len(pts)}")
for i, p in enumerate(pts):
    if i % 12 == 0 or not p.get('is_historical') or i >= len(pts) - 15:
        print(f"{i:3d}: {p.get('period'):15s} | Phys: {str(p.get('physical')):>6s}% | RevCost%: {str(p.get('revised_cost')):>6s}% | Exp%: {str(p.get('expenditure')):>6s}% | Hist: {p.get('is_historical')}")
