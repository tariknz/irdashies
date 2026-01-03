import fs from 'fs';
import { TrackDrawing } from '../src/frontend/components/TrackMap/TrackCanvas';
import { BROKEN_TRACKS } from '../src/frontend/components/TrackMap/tracks/brokenTracks';

interface TrackInfo {
  track_id: number;
  track_name: string;
  config_name: string;
}

interface AnalysisResult {
  total: number;
  working: number;
  broken: number;
  missingStartFinish: number;
  missingActive: number;
  missingBoth: number;
  explicitlyBroken: number;
  brokenByIssue: Record<string, number>;
}

interface BrokenTracksByIssue {
  'non-continuous': number;
  'no position': number;
  'two paths': number;
  'figure 8': number;
}

export const analyzeTracks = (): void => {
  // Read the tracks.json file
  const tracksData: Record<number, TrackDrawing | undefined> = JSON.parse(
    fs.readFileSync('./src/frontend/components/TrackMap/tracks/tracks.json', 'utf8')
  );

  // Known broken track IDs from brokenTracks.ts (manually extracted)
  const knownBrokenIds = BROKEN_TRACKS.map(track => track.id);

  // Read track info for names
  const trackInfo: TrackInfo[] = JSON.parse(fs.readFileSync('./asset-data/track-info.json', 'utf8'));

  // Create a map of track IDs to track names
  const trackIdToName: Record<number, string> = {};
  trackInfo.forEach(track => {
    trackIdToName[track.track_id] = track.track_name;
  });

  // Analyze tracks
  const analysis: AnalysisResult = {
    total: 0,
    working: 0,
    broken: 0,
    missingStartFinish: 0,
    missingActive: 0,
    missingBoth: 0,
    explicitlyBroken: 0,
    brokenByIssue: {}
  };

  Object.entries(tracksData).forEach(([trackId, trackData]) => {
    analysis.total++;
    
    const id = parseInt(trackId);
    const trackName = trackIdToName[id] || `Track ${id}`;
    
    // Check if track is explicitly marked as broken
    if (knownBrokenIds.includes(id)) {
      analysis.explicitlyBroken++;
      analysis.broken++;
      return;
    }
    
    // Check for missing critical data
    const hasStartFinish = trackData?.startFinish?.point;
    const hasActive = trackData?.active?.inside;
    
    if (!hasStartFinish && !hasActive) {
      analysis.missingBoth++;
      analysis.broken++;
      console.log(`Track ${id} (${trackName}): Missing both startFinish and active`);
    } else if (!hasStartFinish) {
      analysis.missingStartFinish++;
      analysis.broken++;
      console.log(`Track ${id} (${trackName}): Missing startFinish point`);
    } else if (!hasActive) {
      analysis.missingActive++;
      analysis.broken++;
      console.log(`Track ${id} (${trackName}): Missing active path`);
    } else {
      analysis.working++;
    }
  });

  // Count broken tracks by issue type
  const brokenTracksByIssue: BrokenTracksByIssue = {
    'non-continuous': 0,
    'no position': 0,
    'two paths': 0,
    'figure 8': 0
  };

  knownBrokenIds.forEach(id => {
    // Determine issue type based on known broken tracks
    if ([168, 173, 175, 176, 202, 207, 209, 211, 217, 388, 239, 240, 242, 246, 247].includes(id)) {
      brokenTracksByIssue['non-continuous']++;
    } else if ([193, 400].includes(id)) {
      brokenTracksByIssue['no position']++;
    } else if ([437, 452].includes(id)) {
      brokenTracksByIssue['two paths']++;
    } else if ([506].includes(id)) {
      brokenTracksByIssue['figure 8']++;
    }
  });

  // Generate the table
  console.log('\n=== TRACK ANALYSIS SUMMARY ===\n');

  console.log('| Category | Count | Percentage |');
  console.log('|----------|-------|------------|');
  console.log(`| **Total Tracks** | ${analysis.total} | 100% |`);
  console.log(`| **Working Tracks** | ${analysis.working} | ${(analysis.working / analysis.total * 100).toFixed(1)}% |`);
  console.log(`| **Broken Tracks** | ${analysis.broken} | ${(analysis.broken / analysis.total * 100).toFixed(1)}% |`);
  console.log('| | | |');
  console.log('| **Breakdown of Broken Tracks:** | | |');
  console.log(`| - Explicitly marked as broken | ${analysis.explicitlyBroken} | ${(analysis.explicitlyBroken / analysis.total * 100).toFixed(1)}% |`);
  console.log(`| - Missing startFinish point | ${analysis.missingStartFinish} | ${(analysis.missingStartFinish / analysis.total * 100).toFixed(1)}% |`);
  console.log(`| - Missing active path | ${analysis.missingActive} | ${(analysis.missingActive / analysis.total * 100).toFixed(1)}% |`);
  console.log(`| - Missing both | ${analysis.missingBoth} | ${(analysis.missingBoth / analysis.total * 100).toFixed(1)}% |`);

  console.log('\n=== BROKEN TRACKS BY ISSUE TYPE ===\n');

  console.log('| Issue Type | Count | Percentage of Broken |');
  console.log('|------------|-------|---------------------|');
  Object.entries(brokenTracksByIssue).forEach(([issue, count]) => {
    if (count > 0) {
      console.log(`| ${issue} | ${count} | ${(count / analysis.broken * 100).toFixed(1)}% |`);
    }
  });

  console.log('\n=== DETAILED BREAKDOWN ===\n');
  console.log(`Total tracks analyzed: ${analysis.total}`);
  console.log(`Working tracks: ${analysis.working} (${(analysis.working / analysis.total * 100).toFixed(1)}%)`);
  console.log(`Broken tracks: ${analysis.broken} (${(analysis.broken / analysis.total * 100).toFixed(1)}%)`);
  console.log(`  - Explicitly broken: ${analysis.explicitlyBroken}`);
  console.log(`  - Missing startFinish: ${analysis.missingStartFinish}`);
  console.log(`  - Missing active path: ${analysis.missingActive}`);
  console.log(`  - Missing both: ${analysis.missingBoth}`);
};
