import { BaseChart, ChartConfig } from './base';

export interface HeatmapConfig extends ChartConfig {
    xField: string;
    yField: string;
    colorField: string;
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
        // x: this.channelConfigs.encodingDefs.x,
        // y: this.channelConfigs.encodingDefs.y,
        // x: {field: "x", type: "nominal"}, y: {field: "y", type: "nominal"},
        // this is already provided, as we assume the color field is not specified (no specification => aggregation)
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

