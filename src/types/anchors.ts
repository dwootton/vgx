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

type Scalar = number;

type Set = Scalar[] | Range[];


type Range = {
    start: Scalar;
    end: Scalar;
}

export type EncodingValues = "NumericScalar" | "CategoricalScalar" | "Set" | "Range";

export type InteractorSchema = {
  schemaId: string; // 'current', 'span'
  schemaType: EncodingValues
  extractors: Record<string,any>
}

// type ScalarEncoding = {
//     type: 'scalar';
//     value: Scalar;
// }

// type SetEncoding = {
//     type: 'set';
//     value: Set;
// }

// type RangeEncoding = {
//     type: 'range';
//     value: Range;
// }

// export type EncodingValueSchema = ScalarEncoding | SetEncoding | RangeEncoding;

// Base value types
export type ValueType = 'Numeric' | 'Categorical' |'Boolean'| 'Encoding' | 'Data';// | 'Boolean';

// Base container types
export type ContainerType = 'Scalar' | 'Set' | 'Range' | 'Absolute'; // TODO change data to a valueType

export interface SchemaType {
  container: ContainerType;
  valueType: ValueType | SchemaType; // Recursive - can nest another schema
  interactive?: boolean;
}


export const RangeSchema : SchemaType = {
  container:'Range',
  valueType:'Numeric'
}
// Type helpers for common patterns
export const NumericScalar: SchemaType = { 
  container: 'Scalar', 
  valueType: 'Numeric' 
};

export const CategoricalSet: SchemaType = { 
  container: 'Set', 
  valueType: 'Categorical' 
};

export const SetOfNumericScalars: SchemaType = {
  container: 'Set',
  valueType: NumericScalar
};

export type AnchorSchema = Record<string, SchemaType>;

//Now actually instantiated values during compilation
export type ScalarValue = {
  value: string; // maps to the expression for the value
}

export type SetValue = {
  value: string; // maps to the expression for the value
}

  export type AbsoluteValue = {
    value: string; // maps to the expression for the value
  }

  export type DataValue = {
    data: DataAccessor; // maps to the expression for the value
    field: string; // maps to the expression for the value
  }
  


export type RangeValue = {
  start: string; // maps to the expression for the value
  stop: string; // maps to the expression for the value
}

export type SchemaValue = SetValue | ScalarValue | RangeValue | AbsoluteValue | DataValue;

// {X:X<range>}

// export type AnchorSchema = InfoAnchorSchema | EncodingAnchorSchema;

export interface AnchorProxy {
  component: BaseComponent;
  id: AnchorId;
  anchorSchema: AnchorSchema;
  bind: (target: AnchorProxy) => BaseComponent;
  compile: (nodeId?: string) =>SchemaValue; // produces a expr string
}


// src/types/anchors.ts
export enum AnchorType {
  // Encoding channels
  X = 'x',
  Y = 'y',
  COLOR = 'color',
  SIZE = 'size',
  SHAPE = 'shape',
  OPACITY = 'opacity',
  
  // Spatial variants
  X1 = 'x1',
  X2 = 'x2',
  Y1 = 'y1',
  Y2 = 'y2',
  
  // Mark properties
  MARK_NAME = 'markName',
  MARK_TYPE = 'markType',
  
  // Data related
  DATA = 'data',
  FIELD = 'field',
  
  // Interaction related
  SELECTION = 'selection',
  FILTER = 'filter',
  
  // Data related
  DATA_TRANSFORMS = 'dataTransforms', 

  TEXT = 'text',
  // Misc
  OTHER = 'other'
}
// brush.sides.top 
// brush.sides-> get the anchor proxy for sides
// sides.top -> get the anchor proxy for top
  

import { NumericEncodingConstraint,CategoricalEncodingConstraint } from './constraints';
import { DataAccessor } from 'components/DataAccessor';

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
