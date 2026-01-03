import csv, json, os

TSV_PATH = "data/verses.tsv"
JSON_PATH = "data/verses.json"

def norm(s):
    return (s or "").strip()

def truthy(s):
    return norm(s).lower() in {"true", "t", "1", "yes", "y"}

verses = []

with open(TSV_PATH, "r", encoding="utf-8") as f:
    reader = csv.DictReader(f, delimiter="\t")
    for row in reader:
        vid = norm(row.get("id"))
        if not vid:
            continue

        def g(k):  # get
            return norm(row.get(k))

        has_p12 = truthy(g("has_p12"))
        has_p34 = truthy(g("has_p34"))
        needs_split_practice = truthy(g("needs_split_practice"))

        p1 = g("p1"); p2 = g("p2"); p3 = g("p3"); p4 = g("p4")

        verse = {
            "id": vid,
            "title": g("title") or vid,
            "meter": g("meter") or "—",
            "full": g("full"),

            # canonical pāda split (always keep this for reference)
            "text": {"p1": p1, "p2": p2, "p3": p3, "p4": p4},

            # practice text (defaults to canonical if blank)
            "practice": {
                "p1": g("pr_p1") or p1,
                "p2": g("pr_p2") or p2,
                "p3": g("pr_p3") or p3,
                "p4": g("pr_p4") or p4,
            },

            # THIS is what app.js will use for special verses like niti_001
            "needsSplitPractice": needs_split_practice,

            "available": {"p12": has_p12, "p34": has_p34},

            "audio": {
                # Note: For special verses you may not have *_p1/_p2.
                # app.js will avoid requesting them when needsSplitPractice=true.
                "p1": f"audio/{vid}_p1.mp3",
                "p2": f"audio/{vid}_p2.mp3",
                "p3": f"audio/{vid}_p3.mp3",
                "p4": f"audio/{vid}_p4.mp3",
                "p12": f"audio/{vid}_p12.mp3" if has_p12 else None,
                "p34": f"audio/{vid}_p34.mp3" if has_p34 else None,
                "full": f"audio/{vid}_full.mp3",
            },

            "gloss": {"sa": g("अर्थः"), "en": g("meaning")},
        }

        verses.append(verse)

os.makedirs("data", exist_ok=True)
with open(JSON_PATH, "w", encoding="utf-8") as f:
    json.dump(verses, f, ensure_ascii=False, indent=2)

print(f"Generated {len(verses)} verses → {JSON_PATH}")
