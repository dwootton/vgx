import { BaseComponent } from 'components/base';
import { Point, Line, Rect, Path } from './geometry';

export type BindingType = 'geometric' | 'event' | 'encoding';




export interface GeometricAnchor<T> {
  id: string;
  type: 'geometric';
  geometry: T;
}

export interface EventAnchor {
  id: string;
  type: 'event';
  eventType: 'start' | 'during' | 'end' | 'click' | 'hover' |'state';
}

export interface EncodingAnchor {
  id: string;
  type: 'encoding';
  channel: string;
}

export type Anchor = GeometricAnchor<Point | Line | Rect | Path> | EventAnchor | EncodingAnchor;

export interface AnchorProxy {
  component: BaseComponent;
  id: string;
  type: 'encoding' | 'event' | 'geometric' | 'group';
  bind: (target: AnchorProxy) => BaseComponent;
  // other proxy properties
}

// Used for binding groups of anchors like the corners of a rectangle
export interface AnchorGroup {
    id: string;
    type: 'group';
    children: Map<string, Anchor>;
  }
  
  export  type AnchorOrGroup = Anchor | AnchorGroup;