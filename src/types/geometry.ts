// src/types/geometry.ts
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
  