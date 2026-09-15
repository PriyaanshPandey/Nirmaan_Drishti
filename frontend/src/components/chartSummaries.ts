export const formatChartNumber = (value: number): string => value.toLocaleString('en-IN');

import type { ChartDataSummary } from './ExplainabilityInfo';

export const describeComparison = (largerLabel: string, larger: number, smallerLabel: string, smaller: number): string => {
  if (smaller <= 0 || larger <= smaller) return '';
  const ratio = larger / smaller;
  return `${largerLabel} is approximately ${ratio.toFixed(1)} times ${smallerLabel}.`;
};

export const summarizeRiskDistribution = (
  entries: Array<{ name: string; count: number; percentage?: number }>
): ChartDataSummary => {
  const items = entries.map((entry) => ({
    label: entry.name,
    value: `${formatChartNumber(entry.count)} projects${entry.percentage !== undefined ? ` (${entry.percentage}%)` : ''}`
  }));
  const high = entries.find((entry) => /high|critical/i.test(entry.name));
  const medium = entries.find((entry) => /medium|monitoring/i.test(entry.name));
  return {
    items,
    insight: high && medium ? describeComparison(medium.name, medium.count, high.name, high.count) : undefined
  };
};

export const summarizeSectorValues = (
  entries: Array<{ name: string; value: number; suffix: string }>
): ChartDataSummary => ({
  items: entries.map((entry) => ({
    label: entry.name,
    value: `${formatChartNumber(entry.value)}${entry.suffix}`
  }))
});
