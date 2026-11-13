# Turnierformate und Ablauf

### Turnierformate

Pro Spielklasse einzeln einstellbar:

| Format | Ablauf | Min. Teilnehmer |
| --- | --- | --- |
| `groups_ko` *(Standard)* | Gruppenphase im Round-Robin, danach KO. Lucky-Loser-Plätze füllen den Baum optional auf. | 4 |
| `round_robin_finals` | Eine Liga (jeder gegen jeden), die besten vier spielen Halbfinale, Finale und Spiel um Platz 3. | 4 |
| `round_robin` | Jeder gegen jeden, eine Tabelle, kein KO. | 3 |
| `ko_only` | Reines KO mit gesetzter Auslosung und Freilosen. | 2 |
| `swiss` | Schweizer System mit Buchholz/Sonneborn-Berger. | 4 |

Mischen ist erlaubt: Herren A als `groups_ko`, Jugend als `swiss`,
Damen-Doppel als `round_robin` - alles im selben Turnier.

### Auslosungsmodi

- **Zufällig** - mit deterministischem Mulberry32-RNG. Gleicher Seed →
  gleiche Auslosung. Hilft beim "Moment, war das wirklich richtig?".
- **Gesetzt (Schlange)** - Snake-Verteilung nach Setzplatz, damit die starken
  Spieler in unterschiedlichen Gruppen landen.
- **Manuell** - Algorithmus überspringen und Spieler selbst auf Gruppen
  verteilen.

### Spielplan und Tische

Der Scheduler verteilt die Spiele auf die parallelen Tische und vergibt jedem
Spiel eine Nummer. Für die Gruppenphase wird zusätzlich versucht, dass kein
Spieler in zwei aufeinanderfolgenden Slots antritt - wenn es sich vermeiden
lässt, bekommt jeder zwischen seinen Spielen eine Pause. Wenn alle übrigen
Spiele dieselben Spieler betreffen (kleine Gruppen, ein Tisch), spielt das
Format halt durch.

Jedes Spiel hat eine globale Spielnummer (`#1`, `#2`, …). Die taucht in
allen Listen, im KO-Baum und in der Live-Anzeige auf, sodass beim Aufrufen
gut "Spiel 12, Tisch 2" durch die Halle gerufen werden kann.

### Ergebniseingabe

Satz für Satz: `11:3, 11:7`. Die Engine prüft jeden Satz gegen die
Tischtennis-Regeln (`lib/engine/sets.ts`):

- Sieger braucht ≥ `setPoints` (Standard 11) **und** mindestens
  `setMinLead` Punkte Vorsprung (Standard 2).
- Bei Einstand muss jeder weitere Punkt den Vorsprung um genau den
  Mindestabstand vergrößern - also 12:10, 13:11, 14:12 …, niemals 15:10.
- `winSets` legt das Format fest - Bo3 (Standard), Bo5, Bo7.
- Zu viele Sätze, Sätze nach entschiedenem Match oder unmögliche Stände
  werden vor dem Speichern mit deutscher Fehlermeldung abgelehnt.

### Gruppentabellen

Tiebreaker laufen in dieser Reihenfolge:

1. **Siege**
2. **Satzdifferenz**
3. **Punktdifferenz**
4. **Direkter Vergleich** - nur bei genau zwei Spielern gleichauf
5. **Einführungsreihenfolge** - stabile Sortierung, damit die Tabelle
   reproduzierbar ist, wenn alles gleich ist

### KO-Baum

- Gruppensieger setzen sich auf A, B, C, … in einen Baum mit
  `nextPowerOfTwo(#Gruppen)` Plätzen.
- Lücken werden mit **Lucky Losern** gefüllt - die besten Gruppendritten,
  sortiert nach Siegen → Satzdifferenz → Punktdifferenz → Gruppenlabel.
  Pro Spielklasse ein-/ausschaltbar.
- Halbsplit-Paarung: Slot `i` gegen Slot `i + size/2`. Bei vier Gruppen
  also **A gegen C** und **B gegen D**, nicht A gegen B.
- Runden sind beschriftet: *Finale*, *Halbfinale*, *Viertelfinale*,
  *Achtelfinale*, *N. Runde*.
- Folgepartien füllen sich automatisch, sobald die Vorrundenpartie steht.

### Schweizer System

Dutch Pairing mit dem üblichen Drumherum:

- Score-Gruppen (Siege + Freilose).
- Innerhalb einer Score-Gruppe: Score absteigend → Buchholz absteigend →
  Setzplatz aufsteigend.
- Obere Hälfte gegen untere Hälfte, bei erzwungener Wiederholung wird
  durchgetauscht.
- Ungerade Teilnehmerzahl → der schwächste Spieler ohne bisheriges Freilos
  bekommt es (1 Punkt).
- Rangliste: Score → Buchholz → Sonneborn-Berger → Setzplatz.
- `suggestedSwissRounds(playerCount)` schlägt eine Rundenzahl vor.

### Öffentliche Ansicht (`/t/[slug]`)

- Übersicht über das Turnier, Statusbadges pro Spielklasse.
- Tabellen, Spielplan (Spielnummer + Tisch), KO-Baum mit offenen Plätzen.
- Lädt sich alle 30 s neu - pausiert, wenn der Tab nicht sichtbar ist, und
  bekommt zusätzlich Live-Updates per SSE, sobald ein Ergebnis eingetragen
  wurde.
- Mobile-first, läuft auf dem Handy am Schreibertisch.
- Hell-/Dunkelmodus mit Toggle, respektiert `prefers-reduced-motion`.

### Admin-Ansicht (`/admin`)

- Ein Admin, Passwort aus der Umgebung. Bewusst keine Benutzerverwaltung.
- Turnier-Wizard mit Live-Vorschau (Spielanzahl, KO-Größe, geschätzte Dauer).
- Massenimport für Teilnehmer (eine Zeile pro Name) plus Inline-Bearbeitung
  von Name, Verein, Setzplatz.
- Auslosung → Spielplan → Baum auf Knopfdruck. Solange `drawDone` nicht
  gesetzt ist, kann die Auslosung neu gewürfelt werden.
- Drag & Drop zwischen Gruppen, solange noch nichts gespielt wurde.
- "Wird gespielt"-Markierung pro Spiel, damit die Live-Spalte zeigt, was
  gerade an welchem Tisch läuft.
- Demo-Modus: Zufallsergebnisse für offene Spiele füllen, optional pro
  Phase. Praktisch für Trockenläufe.
- QR-Code-Modal mit Kopier-Knopf zum Aushang.
- Match-Result-Dialog mit Inline-Validierung und Undo-Toast.
- Tastatur-freundlich: ESC schließt Dialoge, Fokusring überall.

---
