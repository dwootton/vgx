import { BaseChart, ChartConfig, PositionEncodingDef } from "./base";

export interface LineplotConfig extends ChartConfig {
    xField: string;
    yField: string;
  }
  
  export class LinePlot extends BaseChart {
    constructor(config: LineplotConfig) {
      super({
        ...config,
        mark: 'line'
      });
  
      this.spec.encoding = {
        x: this.channelConfigs.encodingDefs.x as PositionEncodingDef,
        y: this.channelConfigs.encodingDefs.y as PositionEncodingDef
      };
  
      this.initializeAnchors();

    }
  }