import { Scatterplot, LinePlot, BarChart, Heatmap ,Histogram, PieChart} from './components/charts';

export const alx = {
  scatterplot: (config: any) => new Scatterplot(config),
  histogram: (config: any) => new Histogram(config),
  lineplot: (config: any) => new LinePlot(config), 
  barchart: (config: any) => new BarChart(config),
  heatmap: (config: any) => new Heatmap(config),
  piechart: (config:any)=> new PieChart(config)
};
