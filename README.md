# multi-agent-demo-system

📰 Uređivanje novinskog članka
Uloga u redakciji - Agent
* Novinar/Autor - Piše prvi draft na osnovu bullet points
* Urednik - Provjerava stil, tok, jasnoću
* Fact-checker - Označava tvrdnje koje treba verifikovati
* Copy editor - Finalna gramatika i formatiranje

Ulaz: nekoliko bullet points o nekoj temi. Izlaz: poliran članak s komentarima svakog agenta vidljivim u demu.

1. Novinar (Author)

Input: bullet points
Output: prvi draft

može napraviti greške
može ubaciti neprovjerene tvrdnje
stil može biti “raw”

👉 ovo je namjerno — daje materijal drugim agentima

2. Urednik (Editor)

Radi:

poboljšava tok teksta
reorganizuje strukturu
označava dijelove koji su “slabi” ili nejasni

VAŽNO:

ne mora sve popraviti
može vratiti tekst autoru (simulira iteraciju)

👉 ovdje već dobijaš prvi feedback loop

3. Fact-checker

Radi:

označava tvrdnje tipa:
brojke
“studije kažu…”
konkretne činjenice

Output nije čist tekst, nego npr:

komentari tipa: “⚠️ verify this claim”

👉 ključna stvar:
ne popravlja tekst, nego flaguje probleme

4. Editor (ponovo)

Sad ima:

tekst
komentare fact-checkera

Radi:

ublažava tvrdnje
uklanja sumnjive dijelove
ili ih preformuliše

👉 ovo je realno ponašanje u redakciji

5. Copy editor (final layer)

Radi:

gramatika
stil
formatiranje

👉 nema više velikih promjena, samo polish

---

flowchart TD
    A[Bullet Points Input] --> B[Author]

    B --> C[Editor Review]

    C -->|Needs rewrite| B
    C -->|Approved draft| D[Fact-checker]

    D --> E{Issues found?}

    E -->|Yes| F[Editor Revision]
    F --> D

    E -->|No| G[Copy Editor]

    G --> H[Final Article]

---

flowchart LR
    subgraph Author
        A1[Bullet Points]
        A2[Writing Ability]
    end

    subgraph Editor
        B1[Draft Article]
        B2[Style Guidelines]
    end

    subgraph FactChecker
        C1[Draft Article]
        C2[Claim Detection Rules]
    end

    subgraph CopyEditor
        D1[Final Draft]
        D2[Grammar Rules]
    end

---

sequenceDiagram
    participant Author
    participant Editor
    participant FactChecker
    participant CopyEditor

    Author->>Editor: Draft v1
    Editor->>Author: Feedback (revise intro)
    Author->>Editor: Draft v2

    Editor->>FactChecker: Reviewed draft
    FactChecker->>Editor: Flagged claims

    Editor->>Editor: Revise based on flags

    Editor->>CopyEditor: Final draft
    CopyEditor->>Editor: Minor corrections
