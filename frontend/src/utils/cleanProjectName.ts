/**
 * Utility functions for cleaning OCR artifacts, metadata collisions, and raw data prefixes
 * from project names and IDs across Nirmaan Drishti.
 */

export function cleanProjectName(name: string): string {
  if (!name) return 'National Infrastructure Project';
  const cleaned = name
    .replace(
      /^(?:Expenditure\s*\([^)]*\)|Progress is going as per the allotment of budget grant\.?|are awaited from [^.]+\.?|Remarks\s*:?|Target Date of Completion\s*:?)\s*[-:]?\s*/i,
      ''
    )
    .trim();
  return cleaned || name;
}

export function cleanProjectId(id: string | number | undefined | null): string {
  if (!id) return '';
  const str = String(id).trim();
  // Strip trailing .0 from database float conversions (e.g. '701396.0' -> '701396')
  return str.replace(/\.0$/, '');
}
