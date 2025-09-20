import { useLocation } from 'react-router-dom';

export const useCurrentOverlayId = (): string | null => {
  const location = useLocation();
  // Extract overlay ID from path (e.g., "/speedometer" -> "speedometer")
  const pathParts = location.pathname.split('/');
  const overlayId = pathParts[1] || null;

  return overlayId;
};
