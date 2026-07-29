# ILC Design Doctrine — Cold Light

**One field. One fiber of light. Two apertures. Nine rooms.**
Version 2.0 · July 2026 · governs every surface in `design/`
(v1 "Ink & Field" — warm paper, vermilion — retired by founder direction:
ILC is a serious workspace; warm is not ILC.)

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

## 3. The main shape: the Fiber of Light

One line of thought runs through the whole product and never ends
("once an idea, always in the loop"). It is drawn as light on a white
field — the idea's state is where the light is: a diffuse cloud at
rough, strands gathering at explore, a focused core at deep,
interference at compare, rings at re-evaluate, a sealed dot at brief.

- Explore — the thread **frays** into angles (fan order, not ranked).
- Deep — the strands **pull taut and converge** (pressure).
- Evolve — the thread **doubles back** and continues. Never a closed
  circle: the loop never closes.
- Compare — **two threads parallel**, rungs between.
- Lineage — the whole **braid**: live, pruned, dead — all visible.
- Brief — the thread **exits the frame uncut**. Handed over, not ended.

The thread exists at exactly **three scales, nowhere else**:

1. **The Spine** — a hairline rule down every content page; the reading
   position is the single lit tick.
2. **The State Lens** — inside an idea: ONE lit state with its label;
   the other states are unlabeled ghost dots (past filled, future
   hollow), clickable but never unrolled. One persistent idea holds many
   states without losing identity or history — and the interface shows
   one state at a time. The full journey unrolls only in Lineage.
3. **The Mark** — a line that loops once and continues.

**The luminosity law:** glow appears only where the thread IS the
content — landing hero, the state lens, Explore's spine node, Deep's
movement strip, Lineage's braid. Everywhere else the field is flat.

## 4. The theme: Cold Light

A serious workspace. White, cool, exact — the only warmth the product
allows is accuracy. The one luminous thing is the thread itself.

- **Ice ground** (`#FBFCFE` field, `#FFFFFF` sheets, `#F1F3F8` wells),
  flat. Depth = hairline rules + layering. One soft shadow, overlays only.
- **Cool ink** (`#16181D` family). Grays are cool, never warm.
- **The fiber = the state spectrum:** rough `#A3B4EE` → explore `#3D68EE`
  → deep `#4F46E5` → evolve `#6D5BE8` → compare `#7C5CEE` → brief
  `#7C3AED`. Reserved for the thread motif: lens, spine tick, mark,
  lineage fibers, movement strip. **Never on scores, warnings, or
  judgments.**
- **Registers by aperture, not hue floods:**
  - *Open Air* (Explore): blue-washed ice, lighter weights, wide leading.
  - *Pressure* (Deep): indigo-washed, denser layout, tighter leading.
  - Neutral rooms: plain white.
- **Semantics:** evidence = quiet green underline/chips; absence = dashed
  cool gray; score bands = muted dots on the pill only.
- Explicitly not: warm paper, dark-mode AI shelf, glow-as-decoration,
  Notion-white emptiness, terminal-hacker.

## 5. The language

**Three type voices, one loading system** (`next/font` in production;
Google Fonts `<link>` in mockups only):

| Voice | Face | Speaks |
|---|---|---|
| Author | Fraunces (serif) | room titles, verdict prose, bet/handoff — the analyst |
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
- **One state in focus.** The journey never unrolls outside Lineage.
- **Glow only where the thread is the content.**
- **More premium = subtract.** Nothing ships that isn't load-bearing.
