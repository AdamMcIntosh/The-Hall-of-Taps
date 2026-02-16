# Hall of Taps: Math Primer

This document explains how we measure beer quality and popularity so that highly rated beers with few check-ins can be compared fairly to widely distributed beers with tens of thousands of ratings. The system is inspired by baseball’s Wins Above Replacement (WAR). The metrics **wOBAR** (weighted Overall Beer Average Rating) and **Beers Above Replacement (BAR)** originated from [Beergraphs.com](https://beergraphs.com/); we use and extend that framework here.

---

## Overview

- **Replacement level** is the “floor” for each style: the worst-rated beer in the top 70% of that style by check-in volume. Beers are judged against this floor.
- **wOBAR** (weighted Overall Beer Average Rating) is how much better a beer is than that floor: average rating minus replacement level.
- **Volume** uses a logarithmic scale so that the first 10 check-ins matter as much as the next 90, and the first 100 as much as the next 9,900. This keeps low-volume beers meaningful.
- **BAR** combines quality (wOBAR), volume, and a style-specific **scale** so that a “perfect” beer (5.0 rating, 1,000 check-ins) equals 15.0 BAR, matching the scale of peak single-season WAR.
- **Adjusted Volume** adds a boost for low-check-in beers so they can compete on a more level playing field. **ABR** (Adjusted BAR) / **TAP** (Hall Rating) uses this adjusted volume instead of raw volume.

---

## Core Formulas

### 1. Replacement level (per style)

- Restrict to beers in that style with valid ratings and at least a minimum number of check-ins (e.g. &gt; 5).
- Sort those beers by **number of check-ins**, descending.
- Take the **top 70% by count** (e.g. `count = floor(0.70 × listCount)`, minimum 1).
- **Replacement level** = the **lowest** average rating among those top-70%-by-volume beers.

So replacement level is “the worst beer in the set of beers that get most of the check-ins in that style.”

### 2. wOBAR (weighted Overall Beer Average Rating)

How much better than the style floor a beer is:

**wOBAR = Average Rating − Replacement Level**

Example: If the replacement level for American IPA is 3.4 and a beer’s average rating is 4.1, then wOBAR = 4.1 − 3.4 = 0.7.

### 3. Volume (raw)

We use base-10 log of check-ins so that volume doesn’t dominate and small beers still matter:

**Volume = log₁₀(# of check-ins)**

- 10 check-ins → 1  
- 100 → 2  
- 1,000 → 3  
- 10,000 → 4  

### 4. Scale (per style)

We scale so that a “perfect” beer (5.0 rating, 1,000 check-ins) equals 15.0 BAR (analogous to Babe Ruth’s 1923 WAR). Scale depends on the style’s replacement level:

**Scale = (15.0 / log₁₀(1,000)) / (5 − Replacement Level)**

Since log₁₀(1,000) = 3:

**Scale = 5 / (5 − Replacement Level)**

If (5 − Replacement Level) ≤ 0, the scale is guarded (e.g. no division by zero).

### 5. BAR (Beers Above Replacement) — raw volume

**BAR = wOBAR × Volume × Scale**

This is the main “quality × popularity” metric before any adjustment for low check-ins.

### 6. Adjusted Volume and ABR / TAP (Hall Rating)

To give low-check-in beers a fairer shot, we add an **Adjustment Factor (AF)** to volume.

**Adjustment Factor (AF):**

- **AF = (C / log₁₀(check-ins + E)) + 1**  
- Defaults: **C = 5**, **E = 1**.

**Adjusted Volume = log₁₀(# of check-ins) + AF**

Then the Hall Rating (TAP / ABR) is:

**ABR = wOBAR × Adjusted Volume × Scale**

So: same wOBAR and Scale as BAR, but Volume is replaced by Adjusted Volume.

**Interpretation of AF:**  
- The term `log₁₀(check-ins)` is the raw volume.  
- The term `(C / log₁₀(check-ins + E)) + 1` is larger when check-ins are low, so low-volume beers get a volume boost.  
- As check-ins grow, AF shrinks toward 1, and Adjusted Volume behaves more like raw volume.

**Example (C = 5, E = 1):**

| Beer  | Check-ins | log₁₀(check-ins) | AF (approx) | Adjusted Volume (approx) |
|-------|-----------|-------------------|-------------|---------------------------|
| Beer A | 10       | 1                 | 5.81        | 6.81                      |
| Beer B | 1,000    | 3                 | 2.67        | 5.67                      |

So a beer with 10 check-ins can have a *higher* adjusted volume than one with 1,000 check-ins, illustrating how the adjustment “levels the playing field” for underdogs.

---

## BAR scale and descriptors

BAR (and similarly ABR/TAP) can be interpreted using the following ranges:

| BAR range | % of population (approx) | Descriptor        |
|-----------|---------------------------|--------------------|
| 10+       | 0.10%                     | Hall-of-Famer      |
| 8 to 10   | 0.40%                     | MVP                |
| 6 to 8    | 1.10%                     | All Star           |
| 4 to 6    | 4.70%                     | Very Good          |
| 2 to 4    | 18.60%                    | Above Average      |
| 0 to 2    | 45.70%                    | Useful to Average  |
| Below 0   | 29.40%                    | Not Good           |

---

## Glossary

**ABV** — Alcohol by volume.

**ABR** — Adjusted BAR; same as Hall Rating (TAP). Uses Adjusted Volume instead of raw Volume so low-check-in beers get a volume boost. **ABR = wOBAR × Adjusted Volume × Scale.**

**BAR** — Beers Above Replacement. A measure of a beer's quality (originated at [Beergraphs.com](https://beergraphs.com/)): indexed to style (replacement level) and weighted by volume. **BAR = wOBAR × Volume × Scale.** See also the BAR scale table above.

**BAR25** — Sum of BAR for the top 25% of a brewery’s beers (by BAR or by some defined ordering). Measures the brewery’s “peak” output.

**IBU** — International Bittering Units; a measure of bitterness (with known limitations).

**Replacement level** — For a given style, the worst average rating among beers in the **top 70% by check-in volume** for that style. Represents the “lowest common denominator” widely available in that style.

**Scale** — Style-specific factor so that a perfect beer (5.0, 1,000 check-ins) equals 15.0 BAR. **Scale = 5 / (5 − Replacement Level)** (with guard when denominator ≤ 0).

**Solid%** — Percentage of a brewery’s beers that are above average (e.g. using Style+ or a chosen threshold). Example: Solid% = 50% means half of the brewery’s output is above average.

**SOLID** — Measure of how likely you are to get a great beer from a brewery. Based on distance from the mean and put on a 0–100 scale.

**Style+** — A beer’s rating compared to its style, with no volume weighting. **Style+ = (Beer’s rating / Average style rating) × 100.** Good for finding lesser-known beers that rate highly within their style.

**TAP / Hall Rating** — Same as ABR: **wOBAR × Adjusted Volume × Scale.** This is the metric used for Hall of Taps rankings.

**Volume** — Raw volume term: **log₁₀(# of check-ins).**

**wOBAR** — Weighted Overall Beer Average Rating (from [Beergraphs.com](https://beergraphs.com/)): **Average Rating − Replacement Level.** Quality relative to the style floor.

---

## Relative Beer Score (user rating vs style)

If you want to compare a *personal* rating to the style average:

**Relative Beer Score = (Your Rating / Average Style Rating) × 100**

Example: You rate an American IPA 4.2; average for the style is 3.8.  
Relative Beer Score = (4.2 / 3.8) × 100 ≈ 110.5 (you rated it about 10.5% above the style average).

---

## Implementation summary

- **Replacement level:** Top 70% of style beers by check-in count; replacement level = min(rating) in that set.  
- **wOBAR** = Average Rating − Replacement Level.  
- **Volume** = log₁₀(check-ins).  
- **Scale** = 5 / (5 − Replacement Level), guarded.  
- **BAR** = wOBAR × Volume × Scale.  
- **AF** = (C / log₁₀(check-ins + E)) + 1, with C = 5, E = 1.  
- **Adjusted Volume** = log₁₀(check-ins) + AF.  
- **ABR / TAP** = wOBAR × Adjusted Volume × Scale.  
- **Style+** = (Rating / Average style rating) × 100.

This formulation keeps the Hall of Taps math consistent across the site and any backend calculations.
