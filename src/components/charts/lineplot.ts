import { BaseChart, ChartConfig } from "./base";

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
        x: this.channelConfigs.encodingDefs.x,
        y: this.channelConfigs.encodingDefs.y
      };
  
      this.initializeAnchors();

    }
  }