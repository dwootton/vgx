import { Scatterplot, LinePlot, BarChart, Heatmap ,Histogram, PieChart} from './components/charts';
import { Circle } from './components/marks';
import { Brush, Drag } from './components/interactions';
import { Brush as Brush2 } from './components/interactions/Instruments/Brush';

export const alx = {
  scatterplot: (config: any) => new Scatterplot(config),
  histogram: (config: any) => new Histogram(config),
  lineplot: (config: any) => new LinePlot(config), 
  barchart: (config: any) => new BarChart(config),
  heatmap: (config: any) => new Heatmap(config),
  piechart: (config:any)=> new PieChart(config),
  circle: (config:any)=> new Circle(config),
  drag: (config:any)=> new Drag(config),
  brush: (config:any)=> new Brush(config),
  brush2: (config:any)=> new Brush2()
};
