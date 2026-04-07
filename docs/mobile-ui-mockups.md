# Feesight mobile-first mockups (concept)

## Primary objectives
1. What will Orley cost me (total + next payment + annual trend)?
2. What is the incremental cost to stay private to 16 or 18?
3. Where are the fee step-ups (prep -> senior -> sixth form)?
4. How does Orley compare nearby schools on fees?
5. What are typical outcomes (GCSE / A-level bands)?

## IA proposal
- **Overview** (default): answers objectives 1–3 quickly
- **Compare**: objective 4
- **Outcomes**: objective 5
- **Plan**: detailed calculators/curves/stress tests
- **Data**: editable benchmark tables

## Mobile shell (portrait)

```
┌───────────────────────────────────────┐
│ Feesight                              │
│ [Overview][Compare][Outcomes][Plan]   │  <- sticky segmented tabs
├───────────────────────────────────────┤
│ Child plan: Orley (Y4 now)            │
│ Total to 16: £217,422                 │
│ Total to 18: £249,369                 │
│ Next-year fee: £24,549 (+5.0%)        │
├───────────────────────────────────────┤
│ Stage step-ups                         │
│ Pre-Prep -> Prep     +5.0%            │
│ Prep -> Y7/Y8        +0.0%            │
│ Y8 -> Y9             +30.1%           │
├───────────────────────────────────────┤
│ [Open detailed plan]                   │
└───────────────────────────────────────┘
```

## Compare tab (carousel + sticky columns)

```
┌───────────────────────────────────────┐
│ Compare schools                        │
│ [Annual fees] [GCSE] [A-level]         │
├───────────────────────────────────────┤
│ School        | To Y8 | To Y9 | Δ vs O │ <- sticky first column
│ Orley         |200,001|   —   |   —    │
│ MTS           |217,422|249,369|+17,421 │
│ HABS          |256,443|287,712|+56,442 │
│ John Lyon     |191,679|219,927|-8,322  │
│  < swipe horizontally for extra cols > │
└───────────────────────────────────────┘
```

## Outcomes tab (banded metrics)

```
┌───────────────────────────────────────┐
│ Outcomes (typical bands)              │
├───────────────────────────────────────┤
│ HABS                                  │
│ GCSE: 9=47% | 9-8=73% | 9-7=88%       │
│ A-level: A*=46% | A*-A=79%            │
├───────────────────────────────────────┤
│ MTS                                   │
│ GCSE: 9=43% | 9-8=71% | 9-7=88%       │
│ A-level: A*=33% | A*-A=70%            │
└───────────────────────────────────────┘
```

## Landscape behavior (iPhone/iPad)
- Keep top tabs sticky.
- Upgrade comparison/outcomes to wider table with frozen school column.
- Show one additional KPI rail at right (delta vs selected reference school).

## Visual recommendations
- Use larger typography for top KPIs (18–24px).
- Use logo chips + school initials by default, expand to full name on tap.
- Keep advanced tables behind "Show detail" accordions.
- Make benchmark editing a dedicated "Data" tab to reduce cognitive load.
