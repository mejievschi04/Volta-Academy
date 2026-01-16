
You are a **senior UI engineer specialized in modern SaaS LMS platforms**.

Your task is to **style an existing LMS interface** (layout and components already implemented) into a **premium, modern dark-mode LMS**.

You must focus ONLY on **visual styling**, not on changing the layout or product logic.

---


cat mai optimizat si mai simplu, fa ca designul sa fie unificat si standartizat 
(cardurile toate egale butoanele la fel) etc

## 1. COLOR PALETTE (MANDATORY)

Use ONLY:

* Deep black / dark navy backgrounds
  (`#0B1220`, `#0F172A`, `#111827`)
* Light blue primary accent
  (`#38BDF8` or similar sky-blue tone)
* Neutral grays for text and borders

Rules:

* No purple, no gradients with multiple colors
* Blue is the ONLY accent color
* Status colors (success / warning) must be muted

---

## 2. BACKGROUNDS & SURFACES

* Main background: very dark, almost black
* Cards: slightly lighter than background
* No harsh contrast jumps
* Use subtle elevation via **soft shadows**, not borders

---

## 3. TYPOGRAPHY

* Modern sans-serif (Inter / system UI)
* Clear hierarchy:

  * Section titles: medium weight
  * KPI numbers: bold
  * Secondary text: reduced opacity
* Avoid oversized headings

---

## 4. BUTTONS & INTERACTIONS

* Primary buttons:

  * Light blue background
  * Dark text
* Secondary buttons:

  * Transparent background
  * Blue border or blue text
* Hover states:

  * Slight brightness increase
  * Smooth transition (150–200ms)

---

## 5. CARDS

* Consistent border radius: **12px**
* Equal internal padding
* No visual clutter
* Icons (if any):

  * Single color
  * Low opacity
  * Small size

---

## 6. METRICS & PROGRESS

* Progress bars:

  * Blue for active progress
  * Dark track
  * Rounded ends
* Charts:

  * Blue data bars
  * Minimal grid lines
  * No heavy labels

---

## 7. SIDEBAR & HEADER

* Sidebar:

  * Dark background
  * Active item highlighted with blue accent line
* Header:

  * Dark surface
  * Search input with subtle blue focus state
  * Minimal separators

---

## 8. ANIMATIONS & TRANSITIONS

* Use only subtle transitions:

  * hover
  * focus
  * expand/collapse
* No flashy motion or decorative animation

---

## 9. CSS / TAILWIND RULES

* Use CSS variables or Tailwind theme config
* Reusable utility classes
* Avoid inline styles
* Ensure consistency across all components

---

## 10. FINAL OUTPUT

* Styled components that look:

  * professional
  * calm
  * enterprise-grade
* The UI must feel suitable for:

  * corporate LMS
  * tech education platform
  * long admin sessions

---

### FINAL CHECK

If the interface does NOT feel:

* calm
* focused
* premium
  then the styling is incorrect.

---
