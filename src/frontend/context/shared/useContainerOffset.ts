import { useDashboard } from '../DashboardContext/DashboardContext';

/**
 * Returns the offset needed to transform widget coordinates from screen space
 * (relative to primary display) to container space (relative to container window).
 *
 * When the container window spans multiple displays, its origin may be at a
 * negative coordinate (e.g., x=-1920 if secondary monitor is left of primary).
 * Widget coordinates are stored assuming the primary display is at (0,0), so
 * we need to offset them to position them correctly within the container.
 *
 * @returns Offset to add to widget x/y coordinates, or { x: 0, y: 0 } if not available
 */
export const useContainerOffset = (): { x: number; y: number } => {
  const { containerBoundsInfo } = useDashboard();

  if (!containerBoundsInfo) {
    // No bounds info yet - assume no offset needed (single monitor or not ready)
    return { x: 0, y: 0 };
  }

  // Transform from screen space to container space:
  // Widget coords assume primary display at (0,0), but container may start at negative coords
  // Example: container at x=-1920, widget at x=100 → needs to be at 100-(-1920)=2020 in container
  const offsetX = -containerBoundsInfo.expected.x;
  const offsetY = -containerBoundsInfo.expected.y;

  return {
    // Ensure positive zero to avoid -0 in comparisons
    x: offsetX === 0 ? 0 : offsetX,
    y: offsetY === 0 ? 0 : offsetY,
  };
};
