import { BaseComponent } from 'components/base';
import { Point, Line, Area, Path } from './geometry';

export type BindingType = 'geometric' | 'event' | 'encoding';


export interface AnchorId {
  componentId: string;
  anchorId: string; // TODO this needs to be randomized and cant be the actual id of the schema 
}


export interface GeometricAnchorSchema<T> {
  id: string;
  type: 'geometric';
  geometry: T;
}

export interface EventAnchorSchema {
  id: string;
  type: 'event';
  eventType: 'start' | 'during' | 'end' | 'click' | 'hover' |'state';
}

export interface EncodingAnchorSchema {
  id: string;
  type: 'encoding';
  channel: string;
}

export type AnchorSchema = GeometricAnchorSchema<Point | Line | Area | Path> | EventAnchorSchema | EncodingAnchorSchema;

export interface AnchorProxy {
  component: BaseComponent;
  id: AnchorId;
  type: 'encoding' | 'event' | 'geometric' | 'group';
  anchorRef: AnchorOrGroupSchema;
  bind: (target: AnchorProxy) => BaseComponent;
  // other proxy properties
}

// Used for binding groups of anchors like the corners of a rectangle
export interface AnchorGroupSchema {
    id: string;
    type: 'group';
    children: Map<string, AnchorSchema>;
  }
  
export type AnchorOrGroupSchema = AnchorSchema | AnchorGroupSchema;