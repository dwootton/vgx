
import { BaseChart, ChartConfig ,FieldEncodingDef} from './base';

export interface HistogramConfig extends ChartConfig {
    field: string;
  }
export class Histogram extends BaseChart {
    constructor(config: HistogramConfig) {

      config.x
      super({
        ...config,
        mark: {'type':'bar'}
      });
  
      this.spec.encoding = {
        x: {
          field: (this.channelConfigs.encodingDefs.x as FieldEncodingDef).field,
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
  

