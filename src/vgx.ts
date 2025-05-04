import { ScatterplotComponent, ScatterplotProps } from './components/charts/ScatterplotComponent';
import { CircleComponent, CircleProps } from './components/marks/CircleComponent';
import { DragComponent, DragProps } from './components/interaction/DragComponent';
import { ComponentConfig, ComponentProps } from './components/base';
import { RectComponent, RectProps } from './components/marks/RectComponent';
import { ComponentPropsFromPorts } from './components/portUtils';

export const vgx = {
  scatterplot: (config: ScatterplotProps) => new ScatterplotComponent(config),
  circle: (config: CircleProps) => new CircleComponent(config),
  drag: (config: DragProps) => new DragComponent(config),
  rect: (config: RectProps) => new RectComponent(config),
}; 