import { BaseChart, ChartConfig } from './base';
export interface PieChartConfig extends ChartConfig {
  categoryField: string;
}

export class PieChart extends BaseChart {
  constructor(config: PieChartConfig) {
    super({
      ...config,
      mark: 'arc'
    });

    this.spec.transform = [{
      aggregate: [{ op: 'count', as: 'count' }],
      groupby: [config.categoryField]
    }];

    this.spec.encoding = {
      theta: {
        field: 'count',
        type: 'quantitative'
      },
      color: {
        field: config.categoryField,
        type: 'nominal'
      }
    };
    this.initializeAnchors();
  }
}