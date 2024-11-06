// src/charts/base.ts
import { TopLevelSpec } from 'vega-lite/build/src/spec';
import { UnitSpec, GenericUnitSpec } from 'vega-lite/build/src/spec/unit';
import { Encoding } from 'vega-lite/build/src/encoding';
import { Field } from 'vega-lite/build/src/channeldef';
import { StandardType } from 'vega-lite/build/src/type';

import { BaseComponent } from '../base';
import { Point, Line, Rect } from '../../types/geometry';
import { GeometricAnchor, EncodingAnchor } from '../../types/anchors';
import { BindingGraph } from '../../utils/bindingGraph';

export interface ChartConfig {
  data: any[];
  width?: number;
  height?: number;
  title?: string;
  padding?: number;
  mark?: any;
}
// Define our specific spec type that we know will have encoding
export type ChartSpec = GenericUnitSpec<Encoding<Field>, StandardType> & {
  $schema?: string;
  data?: { values: any[] };
  width?: number;
  height?: number;
  title?: string;
};

export class BaseChart extends BaseComponent {
  protected spec: ChartSpec;
  protected width: number;
  protected height: number;
  protected padding: number;

  constructor(config: ChartConfig) {
    super();
    this.width = config.width || 400;
    this.height = config.height || 300;
    this.padding = config.padding || 20;

    this.spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      title: config.title,
      data: { values: config.data },
      mark: config.mark,
      width: this.width,
      height: this.height,
      encoding: {}
    };

    // Register this component's anchors with the binding graph
    this.bindingGraph.addComponent(this.id, this.anchors);
    this.initializeAnchors();
  }

  public initializeAnchors() {
    this.initializeGeometricAnchors();
    this.initializeEncodingAnchors();
  }

  protected initializeGeometricAnchors() {
    const p = this.padding;
    const w = this.width;
    const h = this.height;

    // Line anchors
    this.anchors.set('top', {
      id: 'top',
      type: 'geometric',
      geometry: { x1: p, y1: p, x2: w - p, y2: p } as Line,
      bind: this.createAnchorProxy('top')
    });

    this.anchors.set('bottom', {
      id: 'bottom',
      type: 'geometric',
      geometry: { x1: p, y1: h - p, x2: w - p, y2: h - p } as Line,
      bind: this.createAnchorProxy('bottom')
    });

    // Point anchors
    this.anchors.set('topLeft', {
      id: 'topLeft',
      type: 'geometric',
      geometry: { x: p, y: p } as Point,
      bind: this.createAnchorProxy('topLeft')
    });

    // Rect anchor
    this.anchors.set('plotArea', {
      id: 'plotArea',
      type: 'geometric',
      geometry: { x1: p, y1: p, x2: w - p, y2: h - p } as Rect,
      bind: this.createAnchorProxy('plotArea')
    });
  }

  protected initializeEncodingAnchors() {
    //@ts-ignore
    Object.entries(this.spec.encoding).forEach(([channel, encoding]) => {
      this.anchors.set(channel, {
        id: channel,
        type: 'encoding',
        channel,
        //@ts-ignore
        value: encoding,
        bind: this.createAnchorProxy(channel)
      });
    });
  }

  async compile() {
    let compiledSpec = { ...this.spec };
    
    // Get all bindings for this component
    const bindings = this.bindingGraph.getBindings(this.id);
    
    // Process each binding
    for (const binding of bindings) {
      // Get the target component through the binding
      const targetAnchors = this.bindingGraph.getComponentAnchors(binding.target.componentId);
      if (!targetAnchors) continue;

      const targetAnchor = targetAnchors.get(binding.target.anchorId);
      if (!targetAnchor) continue;

      // If the target has a spec, merge it
      if ('getSpec' in targetAnchor && typeof targetAnchor.getSpec === 'function') {
        const targetSpec = targetAnchor.getSpec();
        compiledSpec = this.mergeSpecs(compiledSpec, targetSpec);
      }
    }

    return {
      vegaLiteSpec: compiledSpec,
      bindingGraph: this.bindingGraph
    };
  }

  protected mergeSpecs(baseSpec: ChartSpec, newSpec: Partial<ChartSpec>): ChartSpec {
    //@ts-ignore
    return {
      ...baseSpec,
      ...newSpec,
      encoding: {
        //@ts-ignore
        ...baseSpec.encoding,
        //@ts-ignore
        ...newSpec.encoding
      }
    };
  }

  // Proxy getters for anchors
  get x() { return this.createAnchorProxy('x'); }
  get y() { return this.createAnchorProxy('y'); }
  get color() { return this.createAnchorProxy('color'); }
  get top() { return this.createAnchorProxy('top'); }
  get bottom() { return this.createAnchorProxy('bottom'); }
  get plotArea() { return this.createAnchorProxy('plotArea'); }
}