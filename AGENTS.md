# LifeEvents project instructions

These are project-wide invariants. Apply them to every relevant change unless the user explicitly requests different behavior.

## Privacy mode

- `?privacy=true` (the **Hide exact values** feature) is a first-class display mode. Review every UI change in both normal and privacy modes.
- In privacy mode, mask exact user-specific inputs, configuration, records, and values derived from them in prose, labels, legends, tooltips, annotations, summaries, and accessible text. This includes the user's money, dates, durations, and growth rates/percentages.
- Public data fetched from the Internet, such as standalone market-index history, does not need to be masked. If public data is combined with user-specific data, continue to mask any exact values that expose the user's inputs, records, configuration, or derived results.
- Use the app's centered-bullet masks from `react-app/src/utils/privacy-utils.ts`, retaining units or explanatory wording when useful.
- Check for indirect leaks, including dynamically generated series names, hover content, marker labels, headings, `title` attributes, and ARIA text.

## Financial projections

- The near-term annual growth rate applies through and including `planned_monthly_contributions_until`. The long-term rate starts in the following month.
- Fetched historical-index growth scenarios use their fetched average rate for the full projection horizon.
- The index + planned scenario uses planned contributions through the cutoff month inclusive, then the same latest minimum contribution used by the index + min scenario.
- Add or update regression tests whenever projection timing, rates, or contribution rules change.

## Chart consistency

- A series must use the same short name in its chart tooltip and its expanded legend.
- Matching series shown in multiple charts must use matching colors and visual conventions.
- Include visible markers and annotations when calculating chart domains so they are not clipped.
