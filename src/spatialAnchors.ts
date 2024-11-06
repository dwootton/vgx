// Basic geometric types
export interface Point {
    x: number;
    y: number;
  }
  
  export interface Line {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }
  
  export interface Rect {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }
  
  export interface PathSegment {
    type: 'M' | 'L' | 'C' | 'Q';
    points: Point[];
  }
  
  export interface Path {
    segments: PathSegment[];
  }
  
  // Spatial anchor types as discriminated union
  export interface PointAnchor {
    type: 'point';
    value: Point;
  }
  
  export interface LineAnchor {
    type: 'line';
    value: Line;
  }
  
  export interface RectAnchor {
    type: 'rect';
    value: Rect;
  }
  
  export interface PathAnchor {
    type: 'path';
    value: Path;
  }
  
  export type SpatialAnchor = 
    | PointAnchor 
    | LineAnchor 
    | RectAnchor 
    | PathAnchor;

    