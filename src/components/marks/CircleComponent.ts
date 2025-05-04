import { BaseComponent, ComponentArgument, ComponentConfig, ComponentProps } from '../base';
import { ChannelType } from '../../types/portTypes';
import { CompilationContext, DerivedDataConfig, StaticComponentProcessor } from '../../types/components';
import { createBaseState, PortValue } from '../portExpressions';
import { AllPortTypes } from '../../types/portTypes';
import { PortConfiguration } from '../portExpressions';
import { StaticStateDriver } from '../base';
import { markNameValue, ComponentPropsFromPorts } from '../portUtils';
// First, define the base state
const initCircleState = {
  // Geometry
  x: 0,
  y: 0,
  size: 50,

  // Aesthetics
  stroke: 'firebrick',
  strokeWidth: 2,
  strokeOpacity: 0.7,
  fill: 'firebrick',
  fillOpacity: 0.2,

  // Identity
  markName: markNameValue
};

const circleStateRef = createBaseState(initCircleState);

// Port Groups
const portGroup = {
  DEFAULT: 'default',    // Basic circle properties (x, y, size)
};

// Port Configurations
const portConfigurations: PortConfiguration[] = [
  // Default mode - circle center and radius
  { 
    port: AllPortTypes.X, 
    portGroup: portGroup.DEFAULT, 
    read: circleStateRef.x 
  },
  { 
    port: AllPortTypes.Y, 
    portGroup: portGroup.DEFAULT, 
    read: circleStateRef.y 
  },
  { 
    port: AllPortTypes.SIZE, 
    portGroup: portGroup.DEFAULT, 
    read: circleStateRef.size 
  },
  { 
    port: AllPortTypes.MARK_NAME, 
    portGroup: portGroup.DEFAULT, 
    read: circleStateRef.markName,
    write: null  // Read-only
  },
  { 
    port: AllPortTypes.SIZE, 
    portGroup: portGroup.DEFAULT, 
    read: circleStateRef.size 
  },
];

export type CirclePortConfigurations = typeof portConfigurations;
export type CircleProps = ComponentPropsFromPorts<CirclePortConfigurations>;

const circleDriver: StaticStateDriver<typeof initCircleState> = {
  type: 'static',
  initialState: initCircleState
};

export class CircleComponent extends BaseComponent {
  constructor(props: CircleProps) {
      super({
          componentProps: props,
          portConfigurations: portConfigurations,
          driver: circleDriver
      });
  }

  compile(compilationContext: CompilationContext): any {
      const {x,y,size,data,fill,stroke,strokeWidth,strokeOpacity,fillOpacity,strokeDash,strokeDashOffset} = compilationContext.state;

      return {
          "name":this.id,
          "mark":{"type":"circle","size":size,"fill":fill,"stroke":stroke,"strokeWidth":strokeWidth,"strokeOpacity":strokeOpacity,"fillOpacity":fillOpacity,"strokeDash":strokeDash,"strokeDashOffset":strokeDashOffset},
          "data":data,
          "encoding":{
              "x":x,
              "y":y,
          }
      };
  }
} 