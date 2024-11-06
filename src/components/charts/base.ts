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
import { RectAnchors } from '../../anchors/rect';
import { EncodingAnchors } from '../../anchors/encodingAnchors';

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

    this.initializeAnchors();
  }

  public initializeAnchors() {

    let encodingAnchors = new EncodingAnchors(this);
    const instantiatedEncodingAnchors = encodingAnchors.initializeEncodingAnchors(this.spec);
    let rectAnchors = new RectAnchors(this);
    const instantiatedRectAnchors = rectAnchors.initializeRectAnchors();


    // Merge Maps directly
    const mergedMap = new Map([...instantiatedEncodingAnchors, ...instantiatedRectAnchors]);
    mergedMap.forEach((anchor) => {
      const proxy = this.createAnchorProxy(anchor)
      this.anchors.set(proxy.id, proxy);
    });
  }



  async compile() {
    let compiledSpec = { ...this.spec };

    // Get all bindings for this component
    const bindings = this.bindingGraph.getBindings(this.id);

    for (const binding of bindings) {
      const targetAnchor = this.bindingGraph.getComponentAnchors(binding.target.componentId)
        ?.get(binding.target.anchorId);

      if (!targetAnchor) continue;

      // if ('getSpec' in targetAnchor) {
      //   const targetSpec = targetAnchor.getSpec();
      //   compiledSpec = this.mergeSpecs(compiledSpec, targetSpec);
      // }
    }

    return {
      vegaLiteSpec: compiledSpec,
      bindingGraph: this.bindingGraph
    };
  }

  protected mergeSpecs(baseSpec: ChartSpec, newSpec: Partial<ChartSpec>): ChartSpec {
    return {
      ...baseSpec,
      ...newSpec,
      encoding: {
        ...baseSpec.encoding,
        ...newSpec.encoding
      }
    };
  }


}