// Charts

export { Brush as Brush2 } from './components/interactions/Instruments/Brush';

// Binding System
export { BindingManager } from './binding/BindingManager';
export { SpecCompiler } from './binding/SpecCompiler';
export { GraphManager } from './binding/GraphManager';


// Main ALX object (backward compatibility)
export { Scatterplot, Histogram, LinePlot, BarChart, Heatmap, PieChart } from './components/charts';
export { Circle } from './components/marks';

import { Scatterplot, Histogram, LinePlot, BarChart, Heatmap, PieChart } from './components/charts';
import { Circle, Line, Text,Rect } from './components/marks';
import { CombinedDrag, Click } from './components/interactions';  
import { Grid, BrushConstructor as Brush } from './components/interactions/Instruments/';
export const all = {
  scatterplot: (config: any) => new Scatterplot(config),
  histogram: (config: any) => new Histogram(config),
  lineplot: (config: any) => new LinePlot(config), 
  barchart: (config: any) => new BarChart(config),
  heatmap: (config: any) => new Heatmap(config),
  piechart: (config:any)=> new PieChart(config),
  circle: (config:any)=> new Circle(config),
  drag: (config:any)=> new CombinedDrag(config),
  brush: (config:any)=> new Brush(config),
  rect: (config:any)=> new Rect(config),
  line: (config:any)=> new Line(config),
  click: (config:any)=> new Click(config),
  Grid: (config:any)=> new Grid(config),
  text: (config:any)=> new Text(config),
};
