//@ts-nocheck
import { compile } from 'vega-lite';
import { View, Anchor, Operator, Interactor, JsonPatch } from './types';
import { generateId } from './utils';

export class BaseView implements View {
  spec: TopLevelSpec;
  vegaPatches: JsonPatch[] = [];
  anchors: Record<string, Anchor> = {};
  operators: Record<string, Operator> = {};

  constructor(spec: TopLevelSpec) {
    this.spec = spec;
  }

  bind(interactor: Interactor, operator?: Operator): View {
    // Add VegaLite spec modifications
    const interactorSpec = interactor.getVegaLiteSpec(this);
    this.spec = {
      ...this.spec,
      ...interactorSpec
    };
    
    // Add Vega patches
    this.vegaPatches = [
      ...this.vegaPatches,
      ...interactor.getVegaPatches(this)
    ];

    return this;
  }

  async compile() {
    // For now, return just the VegaLite spec since we don't need Vega compilation yet
    return {
      vegaLiteSpec: this.spec,
      vegaSpec: this.spec, // This would normally be compiled Vega spec
      patches: this.vegaPatches
    };
  }
}

export class Brush implements Interactor {
  type = 'brush';
  events = [
    { type: 'continuous', event: 'selected' }
  ];

  getVegaLiteSpec(view: View): Partial<TopLevelSpec> {
    return {
      params: [{
        name: "brush",
        select: {
          type: "interval",
          encodings: ["x", "y"]
        }
      }],
      mark: {
        ...(typeof view.spec.mark === 'string' ? { type: view.spec.mark } : view.spec.mark),
        fill: {
          condition: { param: "brush", value: "steelblue" },
          value: "gray"
        }
      }
    };
  }

  getVegaPatches(view: View): JsonPatch[] {
    return [];  // We'll add patches later when needed
  }
}