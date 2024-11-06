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
  
      this.spec.encoding = {
        x: { field: config.xField, type: 'nominal' },
        y: { field: config.yField, type: 'nominal' },
        color: {
          field: config.colorField,
          type: 'quantitative',
          aggregate: config.aggregate || 'mean',
          scale: { scheme: 'blues' }
        }
      };
  
      this.initializeAnchors();
    }
  }

  console.log('Heatmap:', Heatmap); // Add this temporarily to verify the import