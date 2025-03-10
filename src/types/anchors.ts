import {  BaseComponent } from 'components/base';

export interface AnchorId {
  componentId: string;
  anchorId: string; // TODO this needs to be randomized and cant be the actual id of the schema 
}

export type GeometricAnchorIdentifer = 'point' | 'line' | 'area' | 'path';
export type ScaleAnchorIdentifer = "scale"
export type SelectionAnchorIdentifer = 'PointSelection' | 'IntervalSelection' | 'LassoSelection';
export type DataAnchorIdentifer = 'data'; // note: this can take multiple forms, but it represents the internals
export type OtherAnchorIdentifers = string;


// this is the name of the anchor such as "top" or "left", or "x1"
export type AnchorIdentifer = GeometricAnchorIdentifer | SelectionAnchorIdentifer | ScaleAnchorIdentifer | OtherAnchorIdentifers;

// this is the general type of the anchor data. For example, "x1" anchor would be a encoding anchor.
export type AnchorType = 'group' | 'encoding';
export type ChannelType = 'x' | 'y' | 'color' | 'size' | 'shape';
// Anchor Id correspond to all of the different 
export interface AnchorId {
  componentId: string;
  anchorId: string; // TODO this needs to be randomized and cant be the actual id of the schema 
}

export interface InfoAnchorSchema {
    id: string;
    type: 'otherInfo';
    interactive: boolean;
}

export interface EncodingAnchorSchema {
    id: string;
    type: 'encoding';
    channel: ChannelType;
    interactive: boolean;
}


// Used for binding groups of anchors like the corners of a rectangle
export interface AnchorGroupSchema {
    id: string;
    type: 'group';
    children: string[];
    interactive: boolean;
}

export type AnchorSchema = InfoAnchorSchema | EncodingAnchorSchema;
export type AnchorOrGroupSchema = AnchorSchema | AnchorGroupSchema;

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
