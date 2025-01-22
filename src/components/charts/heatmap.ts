import { BaseChart, ChartConfig, PositionEncodingDef } from './base';

export interface HeatmapConfig extends ChartConfig {
    x: string;
    y: string;
    color: string;
    aggregate?: 'count' | 'sum' | 'mean';
  }
  
  export class Heatmap extends BaseChart {
    constructor(config: HeatmapConfig) {
      super({
        ...config,
        mark: 'rect'
      });
  
      // {
      //   field: config.colorField,
      //   type: 'quantitative',
      //   aggregate: config.aggregate || 'mean',
      //   scale: { scheme: 'blues' }
      // }
      //{x: {field: "x", type: "ordinal"}, y: {field: "y", type: "ordinal"}}
      console.log('this.channelConfigs heatmap', this.channelConfigs)
      this.spec.encoding = {
        x: this.channelConfigs.encodingDefs.x as PositionEncodingDef,
        y: this.channelConfigs.encodingDefs.y as PositionEncodingDef,
        color: {
          field: config.color,
          type: 'quantitative',
          aggregate: config.aggregate || 'mean',
          scale: { scheme: 'blues' }
        }
      };

      this.initializeAnchors();

  
    }
  }

