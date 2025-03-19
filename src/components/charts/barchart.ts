import { BaseChart, ChartConfig, PositionEncodingDef } from './base';

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
        mark: {'type':'bar',"fill":'#262626'}
      });

  
      
      this.spec.encoding = {
        x: this.channelConfigs.encodingDefs.x as PositionEncodingDef,
        y: Object.assign(this.channelConfigs.encodingDefs.y, {
          type: 'quantitative',
          aggregate: config.aggregate || 'mean'
        }) as PositionEncodingDef
      };
      this.initializeAnchors();  
    }
  }
  