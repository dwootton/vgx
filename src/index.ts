import { Scatterplot, Histogram, LinePlot, BarChart, Heatmap, Brush } from './components';
import { ChartConfig } from './components/charts/base';
import { MarkRegistry } from './registry/marks';

// Initialize registry
const registry = MarkRegistry.getInstance();

// Register chart types
registry.register('scatterplot', Scatterplot);
registry.register('histogram', Histogram);
registry.register('lineplot', LinePlot);
registry.register('barchart', BarChart);
registry.register('heatmap', Heatmap);

// Register interactive components
registry.register('brush', Brush);
// registry.register('drag_point', DragPoint);
// Export the public API
export const alx = {
  // Registry access
  registry,
  registerMark: (type: string, markClass: any) => registry.register(type, markClass),

  // Chart creation methods with type checking
  scatterplot: (config: ChartConfig) => 
    registry.create('scatterplot', config),

  histogram: (config: ChartConfig & { field: string }) => 
    registry.create('histogram', config),

  lineplot: (config: ChartConfig & { xField: string; yField: string }) => 
    registry.create('lineplot', config),

  barchart: (config: ChartConfig & { xField: string; yField: string }) => 
    registry.create('barchart', config),

  heatmap: (config: ChartConfig & { xField: string; yField: string; colorField: string }) => 
    registry.create('heatmap', config),

  // Interactive component creation methods
  brush: (config = {}) => registry.create('brush', config),
//   drag_point: (config = {}) => registry.create('drag_point', config)
};

// Make available globally
(window as any).alx = alx;

