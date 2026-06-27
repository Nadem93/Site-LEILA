import os

base = "/var/folders/yq/yt7k53rs2ybddbr8qvv0g_8m0000gn/T/opencode/gestion-internat"
files = [
    "dashboard.html", "residents.html", "resident.html", "repertoire.html",
    "presences.html", "ppe.html", "messages.html", "planning.html",
    "journal.html", "vehicules.html", "incidents.html",
    "dashboard-resident.html", "admin.html"
]

for fname in files:
    path = os.path.join(base, fname)
    with open(path, "r") as f:
        lines = f.readlines()
    
    # Find the aside opening and closing lines
    aside_start = None
    aside_end = None
    
    for i, line in enumerate(lines):
        if '  <aside class="sidebar">' in line:
            aside_start = i
        if aside_start is not None and '  </aside>' in line:
            aside_end = i
            break
    
    if aside_start is None or aside_end is None:
        print(f"ERROR: Could not find sidebar in {fname}")
        continue
    
    # Remove from aside_start to aside_end inclusive
    # Also remove the blank line(s) after </aside>
    remove_end = aside_end
    # Remove following blank lines
    while remove_end + 1 < len(lines) and lines[remove_end + 1].strip() == '':
        remove_end += 1
    
    new_lines = lines[:aside_start] + lines[remove_end + 1:]
    
    with open(path, "w") as f:
        f.writelines(new_lines)
    
    print(f"Modified {fname}: removed lines {aside_start+1}-{remove_end+1}")

print("\nDone.")
