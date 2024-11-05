//@ts-nocheck
import { BaseView, Brush } from './core';
import { View } from './types';

export const alx = {
  scatterplot: (data: any[]): View => {
    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      data: { values: data },
      mark: 'point',
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' }
      }
    };
    return new BaseView(spec);
  },

  brush: () => new Brush()
};

(window as any).alx = alx;
