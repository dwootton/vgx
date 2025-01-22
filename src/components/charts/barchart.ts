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

      console.log('this.channelConfigs barchart', this.channelConfigs.encodingDefs.x)
  
      this.spec.encoding = {
        x: this.channelConfigs.encodingDefs.x,
        // y: this.channelConfigs.encodingDefs.y,)
        y: Object.assign(this.channelConfigs.encodingDefs.y, {
          type: 'quantitative',
          aggregate: config.aggregate || 'mean'
        })
      };
      this.initializeAnchors();  
    }
  }
  