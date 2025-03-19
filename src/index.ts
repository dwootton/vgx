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
import { Grid, BrushConstructor, Brush } from './components/interactions/Instruments/';
import { Rect } from './components/marks/rect';
import { createComponentFactory } from './factories/ComponentFactory';


const brush = createComponentFactory(BrushConstructor);
const drag = createComponentFactory(CombinedDrag);
const rect = createComponentFactory(Rect);
const line = createComponentFactory(Line);
const click = createComponentFactory(Click);
// const grid = createComponentFactory(Grid);
const text = createComponentFactory(Text);


export const all = {
  scatterplot: (config: any) => new Scatterplot(config),
  histogram: (config: any) => new Histogram(config),
  lineplot: (config: any) => new LinePlot(config), 
  barchart: (config: any) => new BarChart(config),
  heatmap: (config: any) => new Heatmap(config),
  piechart: (config:any)=> new PieChart(config),
  circle: (config:any)=> new Circle(config),
  drag: drag,
  brush: brush,
  rect: rect,
  line: line,
  click: click,
  Grid: (config:any)=> new Grid(config),
  text: text
};
