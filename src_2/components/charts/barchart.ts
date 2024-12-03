import { BaseChart, ChartConfig } from './base';

export interface BarchartConfig extends ChartConfig {
    xField: string;
    yField: string;
    xType?: 'quantitative' | 'nominal' | 'ordinal';
    aggregate?: 'count' | 'sum' | 'mean';
  }
  
  export class BarChart extends BaseChart {
    constructor(config: BarchartConfig) {
      super({
        ...config,
        mark: 'bar'
      });
  
      this.spec.encoding = {
        x: { 
          field: config.xField, 
          type: config.xType || 'nominal'
        },
        y: { 
          field: config.yField,
          type: 'quantitative',
          aggregate: config.aggregate || 'mean'
        }
      };
  
      this.initializeAnchors();
    }
  }
  