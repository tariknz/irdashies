export interface TrackDrawing {
  active: {
    inside: string;
    outside: string;
    trackPathPoints?: { x: number; y: number }[];
    totalLength?: number;
  };
  startFinish: {
    line?: string;
    arrow?: string;
    point?: { x?: number; y?: number; length?: number } | null;
    direction?: 'clockwise' | 'anticlockwise' | null;
  };
  turns?: {
    x?: number;
    y?: number;
    content?: string;
  }[];
}
