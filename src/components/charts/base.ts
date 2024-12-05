// src/charts/base.ts
import { TopLevelSpec } from 'vega-lite/build/src/spec';
import { UnitSpec, GenericUnitSpec } from 'vega-lite/build/src/spec/unit';
import { Encoding } from 'vega-lite/build/src/encoding';
import { Field } from 'vega-lite/build/src/channeldef';
import { StandardType } from 'vega-lite/build/src/type';

import { BaseComponent } from '../base';
import { getMainRangeChannel, PositionChannel } from 'vega-lite/build/src/channel';
import { AnchorProxy } from 'types/anchors';


export interface ChartConfig {
  data: any[];
  width?: number;
  height?: number;
  title?: string;
  padding?: number;
  mark?: any;
}
// Define our specific spec type that we know will have encoding
export type ChartSpec = Partial<UnitSpec<Field>>;

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
      name: this.id,
      title: config.title,
      data: { values: config.data },
      mark: config.mark,
      //@ts-ignore
      width: this.width,
      height: this.height,
      encoding: {}
    };
  }

  initializeAnchors() {
    console.log('in base chart anchors', this.spec)
    if (!this.spec.encoding) {
      throw new Error('Encoding is required for a chart');
    }

    const anchors: { id: string, proxy: AnchorProxy }[] = [];

    Object.entries(this.spec.encoding).forEach(([key, encoding]) => {
      let scaleName = key;

      // fields like x1, x2 should go to x
      if (isPositionChannel(key)) {
        const positionChannel = getMainRangeChannel(key as PositionChannel);
        scaleName = positionChannel; // used for any reference and inversions 
      }

      anchors.push({
        'id': scaleName, 'proxy': this.createAnchorProxy({
          id: scaleName,
          type: 'scale',
        })
      })
    })
    // for each anchor, add it
    anchors.forEach((anchor) => {
      this.anchors.set(anchor.id, anchor.proxy);
    })
    super.initializeAnchors();

  }

  initializeChartAnchors() {


    // encoding anchor types: 
    // position (define the range of values for a channel)

  }



  compileComponent(): Partial<UnitSpec<Field>> {
    return this.spec;
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

function isPositionChannel(channel: string): boolean {
  return ['x', 'y', 'x2', 'y2'].includes(channel);
}