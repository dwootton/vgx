
// Visual encoding channels
export enum ChannelType {
  X = 'x',
  Y = 'y',
  COLOR = 'color',
  SIZE = 'size',
  SHAPE = 'shape',
  OPACITY = 'opacity',
  TEXT = 'text',
  
  // Spatial variants
  X1 = 'x1',
  X2 = 'x2',
  Y1 = 'y1',
  Y2 = 'y2',

  // Midpoints
  MID_X = 'mid_x',
  MID_Y = 'mid_y',

  // Sizes
  WIDTH = 'width',
  HEIGHT = 'height',
}

// Data-related port types
export enum DataPortType {
  DATA = 'data',
  FIELD = 'field',
  XFIELD = 'xField',
  YFIELD = 'yField',
  DATA_TRANSFORMS = 'dataTransforms'
}

// Mark-related port types
export enum MarkPortType {
  MARK_NAME = 'markName',
  MARK_TYPE = 'markType'
}

// Interaction-related port types
export enum InteractionPortType {
  SELECTION = 'selection',
  FILTER = 'filter',
  SELECTION_NAME = 'selectionName'
}

// Miscellaneous port types
export enum MiscPortType {
  OTHER = 'other',
  ALL = '_all'
}

// Union type that combines all port types
export type PortType = 
  | ChannelType
  | DataPortType
  | MarkPortType
  | InteractionPortType
  | MiscPortType;


  export const AllPortTypes = {
    ...ChannelType,
    ...DataPortType,
    ...MarkPortType,
    ...InteractionPortType,
    ...MiscPortType
  };

  