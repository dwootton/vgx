import {  BaseComponent } from 'components/base';

export interface AnchorId {
  componentId: string;
  anchorId: string; // TODO this needs to be randomized and cant be the actual id of the schema 
}

export type GeometricAnchorType = 'point' | 'line' | 'area' | 'path';
export type ScaleAnchorType = "scale"
export type ChannelAnchorType = 'x' | 'y' | 'x2' | 'y2' | 'color' | 'size' | 'shape';
export type SelectionAnchorType = 'PointSelection' | 'IntervalSelection' | 'LassoSelection';
export type DataAnchorType = 'data'; // note: this can take multiple forms, but it represents the internals
export type OtherAnchorTypes = string;

export type AnchorType = GeometricAnchorType | ChannelAnchorType | SelectionAnchorType | ScaleAnchorType | OtherAnchorTypes;

// AnchorTypes correspond to all of the different 
export interface AnchorId {
  componentId: string;
  anchorId: string; // TODO this needs to be randomized and cant be the actual id of the schema 
}

export interface AnchorSchema {
    id: string;
    type: AnchorType;
}


// Used for binding groups of anchors like the corners of a rectangle
export interface AnchorGroupSchema {
    id: string;
    type: 'group';
    children: Map<string, AnchorOrGroupSchema>;
}

export interface AnchorProxy {
  component: BaseComponent;
  id: AnchorId;
  anchorSchema: AnchorOrGroupSchema;
  bind: (target: AnchorProxy) => BaseComponent;
  compile: () => string; // produces a expr string
}

// brush.sides.top 
// brush.sides-> get the anchor proxy for sides
// sides.top -> get the anchor proxy for top
  
export type AnchorOrGroupSchema = AnchorSchema | AnchorGroupSchema;