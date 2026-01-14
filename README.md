Nītiśatakam – Interactive Learning Tool

Created by Samskrita Bharati, USA

This project is an interactive web-based learning tool for Bharthṛhari’s Nītiśatakam, designed to support systematic oral learning (pāṭha-abhyāsa) of Sanskrit verses using repetition, segmentation, and self-comparison.

The tool works seamlessly on desktop and mobile browsers and requires no installation.

✨ Pedagogical Philosophy

Traditional Sanskrit learning emphasizes:

Learning by quarters (pāda)

Gradual aggregation:
P1 → P2 → P3 → P4 → (P1+P2) → (P3+P4) → Full verse

Repetition chosen by the learner

Listening, reciting, and self-correcting

This tool encodes that pedagogy directly into the interface.

🧩 Core Features
1. Structured Practice Mode

For each verse, learners can choose:

Number of repetitions for:

Individual pādas

Pāda-pairs (P1+P2, P3+P4)

Full verse

Playback speed

The practice flow follows:
(each unit repeated N times before moving on)
2. Practice Sets (Optional)

Learners may practice:

A single verse (default)

A custom set of verses, using familiar notation:
1-10
1,7,8
2-5, 9, 12-14
This enables focused revision and structured memorization.

3. Support for Special Verses

Some verses are traditionally recited with:

P1+P2 continuous

P3+P4 continuous

The tool supports such cases via metadata (needs_split_practice) and adapts:

Practice flow

Audio mapping

Recording & comparison

No compromises to pedagogy are made.

4. Script Switching (Akṣaramukha)

All text is stored in Devanāgarī and rendered dynamically into:
Devanāgarī
IAST
ITRANS
Harvard–Kyoto
Kannada, Telugu, Tamil, Malayalam
Grantha, Śāradā, Bengali, Gujarati
Script conversion happens at render time, preserving textual integrity.
This enables focused revision and structured memorization.

3. Support for Special Verses

Some verses are traditionally recited with:

P1+P2 continuous

P3+P4 continuous

The tool supports such cases via metadata (needs_split_practice) and adapts:

Practice flow

Audio mapping

Recording & comparison

No compromises to pedagogy are made.

4. Script Switching (Akṣaramukha)

All text is stored in Devanāgarī and rendered dynamically into:

Devanāgarī

IAST

ISO 15919

ITRANS

Harvard–Kyoto

Kannada, Telugu, Tamil, Malayalam

Grantha, Śāradā, Bengali, Gujarati

Script conversion happens at render time, preserving textual integrity.
5. Record & Compare (Self-Assessment)

Learners can:

Record their own recitation (browser-based)

Compare:

Reference → My recording

Store recordings locally (IndexedDB)

This supports svādhyāya and self-correction without external tools.
/
├── index.html          # UI layout
├── styles.css          # Theming & layout
├── app.js              # Application logic
├── data/
│   └── verses.json     # Generated verse data
├── audio/
│   ├── niti_001_*.mp3
│   ├── niti_002_*.mp3
│   └── ...

🗂 Data Workflow
Source Data

Verse data is maintained in a TSV file (often from Google Sheets):
id | title | meter | full | p1 | p2 | p3 | p4 |
pr_p1 | pr_p2 | pr_p3 | pr_p4 |
needs_split_practice | has_p12 | has_p34 |
artha_sa | meaning_en
This TSV is converted to verses.json using a simple converter script.
niti_001_p1.mp3
niti_001_p2.mp3
niti_001_p12.mp3
niti_001_p34.mp3
niti_001_full.mp3
he tool auto-detects availability from metadata.

🌐 Hosting

The project is hosted via GitHub Pages and can be accessed at:
https://laksiyer.github.io/nitishatakam/
No backend or server is required.

🔁 Reusability

Although this instance is for Nītiśatakam, the architecture is general and can be reused for:

Any stotra

Sahasranāma

Gītā chapters

Subhāṣita collections

Only the data and audio need to change.

🙏 Acknowledgements

Text references adapted from publicly available Sanskrit sources

Audio recordings by volunteer reciters, Dr. Premkumar Rallabandi

Script conversion powered by Akṣaramukha

📜 License

This project is intended for educational and non-commercial use in the service of Sanskrit learning.
