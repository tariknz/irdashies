export const PRESET_DRIVER_TAGS = [
  { id: 'dangerous', name: 'Dangerous', icon: '⚠️' },
  { id: 'friend', name: 'Friend', icon: '⭐' },
  { id: 'streamer', name: 'Streamer', icon: '📺' },
];

export const getPresetTag = (id?: string) => {
  if (!id) return undefined;
  return PRESET_DRIVER_TAGS.find((g) => g.id === id);
};
