
import { BaseChart, ChartConfig } from './base';

export interface HistogramConfig extends ChartConfig {
    field: string;
  }
export class Histogram extends BaseChart {
    constructor(config: HistogramConfig) {
      super({
        ...config,
        mark: 'bar'
      });
  
      this.spec.encoding = {
        x: {
          field: config.field,
          type: 'quantitative',
          bin: true,
        },
        y: {
          aggregate: 'count',
          type: 'quantitative'
        }
      };
  
      this.initializeAnchors();
    }
  }
  

console.log(Histogram);