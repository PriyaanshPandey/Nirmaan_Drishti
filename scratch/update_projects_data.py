path = 'frontend/src/data/projectsData.ts'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
    "scheduleStatus: 'DELAYED' | 'ON TRACK' | 'CRITICAL' | 'IN PROGRESS';",
    "scheduleStatus: 'DELAYED' | 'ON TRACK' | 'CRITICAL' | 'IN PROGRESS' | 'IN REVIEW';"
)
text = text.replace(
    "): 'CRITICAL' | 'DELAYED' | 'IN PROGRESS' | 'ON TRACK' {",
    "): 'CRITICAL' | 'DELAYED' | 'IN REVIEW' | 'ON TRACK' {"
)

old_target = "    stat === 'IN PROGRESS' ||\n    stat.includes('PROGRESS') ||\n    stat.includes('MONITOR') ||\n    (stat === 'ON TRACK' && (p.progressPhysical ?? 0) > 0 && (p.progressPhysical ?? 0) < 100 && (((p.riskScore ?? 0) >= 25) || p.riskLevel === 'Medium'))\n  ) {\n    return 'IN PROGRESS';"

new_target = "    stat === 'IN REVIEW' ||\n    stat === 'IN PROGRESS' ||\n    stat.includes('REVIEW') ||\n    stat.includes('PROGRESS') ||\n    stat.includes('MONITOR') ||\n    (stat === 'ON TRACK' && (p.progressPhysical ?? 0) > 0 && (p.progressPhysical ?? 0) < 100 && (((p.riskScore ?? 0) >= 25) || p.riskLevel === 'Medium'))\n  ) {\n    return 'IN REVIEW';"

if old_target in text:
    text = text.replace(old_target, new_target, 1)
    print("Replaced logic block successfully")
else:
    # try with \r\n
    old_target_crlf = old_target.replace("\n", "\r\n")
    new_target_crlf = new_target.replace("\n", "\r\n")
    if old_target_crlf in text:
        text = text.replace(old_target_crlf, new_target_crlf, 1)
        print("Replaced CRLF logic block successfully")
    else:
        print("Logic block not found!")

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print("projectsData.ts updated successfully.")
