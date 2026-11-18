import crypto from 'node:crypto';

export interface HashedTrackReport<Track> {
  hash: string;
  properties: {
    version: string;
    data_hash: string;
    track_count: number;
    tracks: Record<string, Track>;
  };
}

type ToTuple<Entry> = (entry: Entry) => unknown[];

const sortedTrackIds = (records: Record<string, unknown>): string[] =>
  Object.keys(records).sort((a, b) => Number(a) - Number(b));

const hashTuples = <Entry>(
  ids: string[],
  records: Record<string, Entry>,
  toTuple: ToTuple<Entry>
): string =>
  crypto
    .createHash('sha256')
    .update(JSON.stringify(ids.map((id) => [id, ...toTuple(records[id])])))
    .digest('hex');

export const hashTrackTuples = <Entry>(
  records: Record<string, Entry>,
  toTuple: ToTuple<Entry>
): string => hashTuples(sortedTrackIds(records), records, toTuple);

export const buildHashedTrackReport = <Entry, Track>(
  records: Record<string, Entry>,
  version: string,
  toTuple: ToTuple<Entry>,
  toTrack: (entry: Entry) => Track
): HashedTrackReport<Track> => {
  const ids = sortedTrackIds(records);
  const hash = hashTuples(ids, records, toTuple);
  const tracks: Record<string, Track> = {};
  for (const id of ids) tracks[id] = toTrack(records[id]);
  return {
    hash,
    properties: { version, data_hash: hash, track_count: ids.length, tracks },
  };
};
