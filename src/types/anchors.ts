import { BaseComponent } from 'components/base';
import { Point, Line, Rect, Path } from './geometry';

export type BindingType = 'geometric' | 'event' | 'encoding';
export type BindFunction = (target: BaseComponent, targetAnchorId: string) => BaseComponent;


export interface GeometricAnchor<T> {
  id: string;
  type: 'geometric';
  geometry: T;
  bind: BindFunction;
}

export interface EventAnchor {
  id: string;
  type: 'event';
  eventType: 'start' | 'during' | 'end' | 'click' | 'hover';
  bind: BindFunction;
}

export interface EncodingAnchor {
  id: string;
  type: 'encoding';
  channel: string;
  bind: BindFunction;
}

export type Anchor = GeometricAnchor<Point | Line | Rect | Path> | EventAnchor | EncodingAnchor;


// Used for binding groups of anchors like the corners of a rectangle
export interface AnchorGroup {
    id: string;
    type: 'group';
    children: Map<string, Anchor>;
    bind: BindFunction;  // Allows binding to all children
  }
  
  export  type AnchorOrGroup = Anchor | AnchorGroup;