// Charts

export { Brush as Brush2 } from './components/interactions/Instruments/Brush';

// Binding System
export { BindingManager } from './binding/BindingManager';
export { SpecCompiler } from './binding/SpecCompiler';
export { GraphManager } from './binding/GraphManager';


// Main ALX object (backward compatibility)
export { Scatterplot, Histogram, LinePlot, BarChart, Heatmap, PieChart } from './components/charts';
export { Circle } from './components/marks';
export { Brush, Drag } from './components/interactions';


// export const alx = {
//   scatterplot: (config: any) => new Scatterplot(config),
//   histogram: (config: any) => new Histogram(config),
//   lineplot: (config: any) => new LinePlot(config), 
//   barchart: (config: any) => new BarChart(config),
//   heatmap: (config: any) => new Heatmap(config),
//   piechart: (config:any)=> new PieChart(config),
//   circle: (config:any)=> new Circle(config),
//   drag: (config:any)=> new Drag(config),
//   brush: (config:any)=> new Brush(config),
//   brush2: (config:any)=> new Brush2(),
//   bindingManager: (config:any)=> BindingManager.getInstance()
// };
