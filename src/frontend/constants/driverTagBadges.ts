export const PRESET_DRIVER_TAGS = [
  { id: 'dangerous', name: 'Dangerous', icon: '⚠️', color: 0xff0000 },
  { id: 'friend', name: 'Friend', icon: '⭐', color: 0x6ba4ff },
  { id: 'streamer', name: 'Streamer', icon: '📺', color: 0x7c3aed },
];

export const getPresetTag = (id?: string) => {
  if (!id) return undefined;
  return PRESET_DRIVER_TAGS.find((g) => g.id === id);
};
