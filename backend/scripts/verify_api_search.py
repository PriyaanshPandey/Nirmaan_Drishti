import urllib.request
import urllib.parse
import json

terms = [
    'N24001958',
    '618256',
    'Chaprathipalem',
    'N16000234',
    '400301',
    'Irugur',
    'N24001257',
    '618291',
    'Kohima',
    'Ghatampur',
    'N06000152',
    '400259'
]

print("=" * 80)
print("API DEDUPLICATION VERIFICATION")
print("=" * 80)

for t in terms:
    url = f"http://127.0.0.1:8000/api/projects?search={urllib.parse.quote(t)}"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        total = data.get('total')
        items = data.get('items', [])
        ids = [(p['id'], p.get('legacyOcmsCode')) for p in items[:3]]
        print(f"Search '{t}': {total} result(s) -> {ids}")
