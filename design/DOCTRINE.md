# ILC Design Doctrine — Ink & Field

**One field. One thread. Two apertures. Nine rooms.**
Version 1.0 · July 2026 · governs every surface in `design/`

This document is the design-side constitution. It derives from the product
doctrine (Master Reference V111, Marketing Doctrine V1.2) and replaces every
prior visual decision. Product doctrine survives; visuals restart.

---

## 1. The position

Every generic AI SaaS visualizes **the product's output** — score panels,
charts, KPI grids, feeds. ILC visualizes **the user's thinking**. The UI's
subject is not the answer; it is the motion of thought around an idea.

What is structurally ILC's own, and what the design must carry:

1. **The refusal** — reads, never verdicts. Every surface is the same refusal
   in a different costume.
2. **Two opposed cognitive modes that may disagree** — widen vs. pressure.
3. **The loop with memory** — ideas never finish; they branch, get pruned,
   get re-read. Selection, not evolution.
4. **The mirror** — "your own mind, externalized." Users recognize their own
   behavior; they never learn ours.

## 2. The mind model (why the design is shaped this way)

- The mind is **one continuous field**, not rooms with doors. Attention
  refocuses; it never teleports. → Navigation must keep something alive
  across every cut.
- Thought is **a thread**. Stages are positions along it, not separate
  objects. → An idea's stages sit on one visible line.
- Two primitive motions: **aperture out** (many faint possibilities) and
  **aperture in** (one thing under bright focus). → Explore and Deep are
  registers of one field, not two brands.
- **Comparison splits working memory** — two things lined up on shared
  dimensions. → Compare is a seam, two spines, rungs between.
- **Returning is re-reading, not rewinding.** → Evolve shows the old read
  and what moved; nothing is erased.
- Switching is **instant but directed** — the mind always knows whether it
  zoomed in, stepped back, or set things side by side. → Transitions are
  fast (150–240ms) with one invariant direction per motion.

## 3. The main shape: the Thread

One line of thought runs through the whole product and never ends
("once an idea, always in the loop").

- Explore — the thread **frays** into angles (fan order, not ranked).
- Deep — the strands **pull taut and converge** (pressure).
- Evolve — the thread **doubles back** and continues. Never a closed
  circle: the loop never closes.
- Compare — **two threads parallel**, rungs between.
- Lineage — the whole **braid**: live, pruned, dead — all visible.
- Brief — the thread **exits the frame uncut**. Handed over, not ended.

The thread exists at exactly **three scales, nowhere else**:

1. **The Spine** — a hairline rule down every content page; sections,
   receipts, and reading position tick off it.
2. **The Thread Bar** — inside an idea: its own loop on one horizontal
   line (captured → explored → deep → evolved → compared → brief),
   every stop real and clickable. Primary navigation within an idea.
3. **The Mark** — a line that loops once and continues.

## 4. The theme: Ink & Field

Analyst's dossier, not machine dashboard. The page feels **written**, not
generated. Plainness is the premium signal.

- **Paper ground** (`#F6F4EE` family), flat. No glows, glass, gradients.
  Depth = hairline rules + paper layering. One shadow, overlays only.
- **Warm ink** (`#1C1B17` family). Grays are warm, never blue.
- **The red thread** (`#C2492F`) — reserved exclusively for the thread
  motif: spine ticks, thread bar, the mark, lineage edges, "you are here."
  **Never on scores, warnings, or judgments.** The one warm beat in a dry
  field.
- **Registers by aperture, not hue floods:**
  - *Open Air* (Explore): cool ink tint, lighter weights, wider whitespace.
  - *Pressure* (Deep): warm graphite, denser layout, tighter leading.
  - Neutral rooms: plain paper.
- **Semantics:** evidence = quiet green underline/chips; absence = dashed
  graphite (amber is retired); score bands = muted dots on the pill only.
- Explicitly not: Notion-white minimalism, Linear-dark, terminal-hacker,
  AI-gradient shelf.

## 5. The language

**Three type voices, one loading system** (`next/font` in production;
Google Fonts `<link>` in mockups only):

| Voice | Face | Speaks |
|---|---|---|
| Author | Literata (serif) | verdict prose, bet/handoff, editorial nudges — the analyst |
| Interface | IBM Plex Sans | chrome, body, controls — the product |
| Instrument | IBM Plex Mono | receipts, metrics, labels, eyebrows — the machine |

Scale on a 4px baseline; **10px floor** (instrument ticks only); prose
measure ~68ch. Radii 2/4/6px — print, not glass. Icons: one set,
single-stroke, 1.5px.

## 6. The rooms and the grammar

Memory is global; thinking is per-thread. Only the Desk and the Shelves
are in global nav. The six thinking rooms are reached through an idea's
thread. Settings / Plan / Help are chrome, not rooms.

| Room | Owns the question | Register |
|---|---|---|
| 1 Landing — the Argument | "Is this how my mind already works?" | paper, editorial |
| 2 Desk (Overview) | "Where was I, what needs my move?" | neutral |
| 3 Shelves (Hub) | "Where are all my threads?" | neutral |
| 4 Explore — the Widening | "What could this become?" | open air |
| 5 Deep — the Pressure Room | "Does this hold?" | pressure |
| 6 Evolve — the Return | "The idea changed — re-read it" | pressure→air |
| 7 Compare — the Seam | "Which bet is heavier?" | neutral, split |
| 8 Lineage — the Braid | "Where did this family go?" | neutral, zoomed out |
| 9 Brief — the Handoff | "What's my first move?" | author-voice heavy |

**Motion grammar** — one motion per navigation, direction invariant:

| Motion | Visual | Duration |
|---|---|---|
| pick up a thread | rises into place, thread bar slides in | 200ms |
| along the thread | horizontal slide (loop direction) | 200ms |
| widen (enter Explore) | blooms outward from the seed line | 200ms |
| pressure (enter Deep) | settles inward/downward | 200ms |
| graduation (angle → Deep) | the strand pulls out of the fan, becomes the taut thread | 240ms |
| compare | seam splits the field | 240ms |
| lineage | zoom out to the braid | 240ms |
| reduced motion | everything → crossfade | 160ms |

Motion carries **orientation only, never judgment**: identical for every
idea regardless of its numbers. Something always survives the cut (thread
bar, rail, idea title). Zero-context hard cuts are forbidden.

## 7. Standing laws (inherited, re-skinned, still binding)

- **No naked numbers.** A score always travels with its handle (direction /
  what-would-move-it).
- **Band color reaches only the pill.** Never sections, prose, or motion.
- **Evidence visibly produces the conclusion** — receipts sit inside the
  claim, not in a bibliography under it.
- **Absence is load-bearing** — gaps render as first-class dashed panels.
- **Honest-or-stubbed, never fabricated.** Verdict-or-dash; no fake states.
- **The display never repairs or editorializes against the engine.**
- **A count is information; a red ✗ list is judgment. Never draw the ✗.**
- **One user question per room. Overlap is not depth.**
- **More premium = subtract.** Nothing ships that isn't load-bearing.
