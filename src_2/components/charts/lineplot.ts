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
        x: { field: config.xField, type: 'quantitative' },
        y: { field: config.yField, type: 'quantitative' }
      };
  
      this.initializeAnchors();
    }
  }