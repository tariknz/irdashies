import type { Telemetry } from '@irdashies/types';

/**
 * Debug utilities for telemetry subscription system
 */

function formatTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return '';

  // Calculate column widths
  const colWidths = headers.map((header, i) => {
    const maxDataWidth = Math.max(...rows.map(row => row[i]?.length || 0));
    return Math.max(header.length, maxDataWidth);
  });

  // Create separator line
  const separator = '─'.repeat(colWidths.reduce((sum, width) => sum + width + 3, 1));

  // Format header
  const headerRow = headers.map((header, i) =>
    header.padEnd(colWidths[i])
  ).join(' │ ');

  // Format data rows
  const dataRows = rows.map(row =>
    row.map((cell, i) =>
      (cell || '').padEnd(colWidths[i])
    ).join(' │ ')
  ).join('\n');

  return `┌${separator}┐\n│ ${headerRow} │\n├${separator}┤\n│ ${dataRows.replace(/\n/g, ' │\n│ ')} │\n└${separator}┘`;
}

export function printSubscriptionStatus(
  fieldSubscriptions: Map<string, Set<keyof Telemetry>>,
  title = 'Telemetry Subscription System Status'
): void {
  const totalSubscriptions = Array.from(fieldSubscriptions.values())
    .reduce((sum, fields) => sum + fields.size, 0);

  console.log(`\n${title}:`);
  console.log(`Total: ${fieldSubscriptions.size} overlays, ${totalSubscriptions} subscriptions\n`);

  if (totalSubscriptions === 0) {
    console.log('No active subscriptions.\n');
    return;
  }

  // Sort overlays by name for consistent output
  const sortedOverlays = Array.from(fieldSubscriptions.entries())
    .sort(([a], [b]) => a.localeCompare(b));

  // Prepare table data
  const tableRows: string[][] = [];
  const fieldDetails: string[] = [];

  sortedOverlays.forEach(([overlayId, fields]) => {
    const fieldCount = fields.size;
    tableRows.push([overlayId, fieldCount.toString()]);

    // Collect field details for expanded view
    const sortedFields = Array.from(fields).sort();

    fieldDetails.push(`\n${overlayId}:`);
    sortedFields.forEach(field => fieldDetails.push(`  ${field}`));
  });

  // Print table
  const headers = ['Overlay', 'Fields'];
  const table = formatTable(headers, tableRows);
  console.log(table);

  // Print detailed field breakdown
  console.log('\nField Details:');
  fieldDetails.forEach(line => console.log(line));
  console.log();
}

export function printSubscriptionChange(
  overlayId: string,
  action: 'added' | 'removed',
  fields: (keyof Telemetry)[]
): void {
  const fieldList = fields.sort().join(', ');
  console.log(`${overlayId} ${action} ${fields.length} fields: ${fieldList}`);
}

export function printSystemReady(fieldSubscriptions: Map<string, Set<keyof Telemetry>>): void {
  const totalSubscriptions = Array.from(fieldSubscriptions.values())
    .reduce((sum, fields) => sum + fields.size, 0);

  console.log('\nTelemetry Subscription System Ready!');
  console.log(`Managing ${fieldSubscriptions.size} overlays with ${totalSubscriptions} total field subscriptions`);
}
