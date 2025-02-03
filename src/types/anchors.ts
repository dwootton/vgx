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
    interactive: boolean;
}


// Used for binding groups of anchors like the corners of a rectangle
export interface AnchorGroupSchema {
    id: string;
    type: 'group';
    children: string[];
    interactive: boolean;
}

export interface AnchorProxy {
  component: BaseComponent;
  id: AnchorId;
  anchorSchema: AnchorOrGroupSchema;
  bind: (target: AnchorProxy) => BaseComponent;
  compile: (nodeId?: string) => {source:string,value:any}; // produces a expr string
}

// brush.sides.top 
// brush.sides-> get the anchor proxy for sides
// sides.top -> get the anchor proxy for top
  
export type AnchorOrGroupSchema = AnchorSchema | AnchorGroupSchema;

import { NumericEncodingConstraint,CategoricalEncodingConstraint } from './constraints';

// when x is passed down to a component, then scale becomes the encoding constraint (adds constraint + initial value (middle))
//
type PriorityOrder = ('context' | 'generated' | 'baseContext')[];

const priorityRules: Record<keyof ValueSchema, PriorityOrder> = {
  initialValue: ['context', 'generated', 'baseContext'],
  fieldValue: ['generated', 'context', 'baseContext'],
  scale: ['context', 'generated', 'baseContext'],
  fieldName: ['context', 'generated', 'baseContext'],
  constraints: ['context', 'generated', 'baseContext'],
};




export type NumericPositionValueSchema = {
  'scale':string, // this is the scale name, used in expr to get the domian
  'scaleType': 'quantitative',
  'fieldName':string, // this is the field name, used in expr to get the value if datum[fieldName]
  'constraints': NumericEncodingConstraint,
  'fieldValue': number,
  'initialValue': number,
}


export type CategoricalPositionValueSchema = {
  'scale':string, // this is the scale name, used in expr to get the domian
  'scaleType': 'ordinal' | 'nominal',
  'fieldName':string, // this is the field name, used in expr to get the value if datum[fieldName]
  'constraints': CategoricalEncodingConstraint,
  'fieldValue': string,
  'initialValue': string,
}

export type PositionValueSchema = NumericPositionValueSchema | CategoricalPositionValueSchema;

export type ValueSchema = PositionValueSchema | string | number;






// Interaction design: how do I specify that clicking on a bar should set that field as the sort order?
