// src/types/geometry.ts
export interface Point {
    type: 'point';
    x: number;
    y: number;
  }
  
  export interface Line {
    type: 'line';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }
  
  export interface Area {
    type: 'area';
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
    type: 'path';
    segments: PathSegment[];
  }
  