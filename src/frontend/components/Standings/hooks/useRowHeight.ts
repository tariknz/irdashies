import { useEffect, useState } from 'react';

/**
 * Custom hook to measure and track table row height dynamically
 * @param tableRef - Reference to the table element
 * @param hasData - Whether there is data to measure from
 * @returns The measured row height in pixels
 */
export const useRowHeight = (
  tableRef: React.RefObject<HTMLTableElement | null>, 
  hasData: boolean
) => {
  const [rowHeight, setRowHeight] = useState<number>(21); // Default fallback

  useEffect(() => {
    if (tableRef.current && hasData) {
      const measureRowHeight = () => {
        const tbody = tableRef.current?.querySelector('tbody');
        if (tbody && tbody.children.length > 0) {
          const firstRow = tbody.children[0] as HTMLElement;
          const height = firstRow.offsetHeight;
          if (height > 0 && height !== rowHeight) {
            setRowHeight(height);
          }
        }
      };

      // Initial measurement
      const timer = setTimeout(measureRowHeight, 0);
      
      // Set up ResizeObserver for dynamic changes
      let resizeObserver: ResizeObserver | null = null;
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          measureRowHeight();
        });
        
        const tbody = tableRef.current?.querySelector('tbody');
        if (tbody) {
          resizeObserver.observe(tbody);
        }
      }
      
      return () => {
        clearTimeout(timer);
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
      };
    }
  }, [tableRef, hasData, rowHeight]);

  return rowHeight;
}; 