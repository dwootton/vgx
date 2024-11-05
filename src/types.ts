//@ts-nocheck
import { TopLevelSpec } from 'vega-lite';
import { Spec as VegaSpec } from 'vega';

export type JsonPatch = {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: any;
  from?: string;
};

export type GeometryType = 'point' | 'line' | 'area' | 'path';

export type EventType = 
  | { type: 'instant'; event: 'click' | 'mouseenter' | 'mouseleave' | 'mousedown' | 'mouseup' }
  | { type: 'continuous'; event: 'selected' | 'hovered' | 'dragging' }
  | { type: 'condition'; expr: string };

export interface Anchor {
  id: string;
  type: 'spatial' | 'transform' | 'encoding' | 'event';
  schema: any;
  data?: any;
}

export interface Operator {
  type: string;
  direction: 'unidirectional' | 'bidirectional';
  transform?: (source: any) => any;
  propagate: (source: Anchor, target: Anchor) => void;
}



export interface View {
  spec: TopLevelSpec;
  vegaPatches: JsonPatch[];
  anchors: Record<string, Anchor>;
  operators: Record<string, Operator>;
  bind: (interactor: Interactor, operator?: Operator) => View;
  compile: () => Promise<{
    vegaLiteSpec: TopLevelSpec;
    vegaSpec: VegaSpec;
    patches: JsonPatch[];
  }>;
}

export interface Interactor {
  type: string;
  events: EventType[];
  getVegaLiteSpec: (view: View) => Partial<TopLevelSpec>;
  getVegaPatches: (view: View) => JsonPatch[];
}