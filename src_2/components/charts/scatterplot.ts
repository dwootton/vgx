import { BaseChart,ChartConfig } from './base';

export interface ScatterplotConfig extends ChartConfig {
  xField: string;
  yField: string;
}

export class Scatterplot extends BaseChart {
  constructor(config: ScatterplotConfig) {
    super({
      ...config,
      mark: 'point'
    });

    this.spec.encoding = {
      x: { field: config.xField, type: 'quantitative' },
      y: { field: config.yField, type: 'quantitative' }
    };

    this.initializeAnchors();
  }
}

