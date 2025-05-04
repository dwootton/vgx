import { BaseComponent, ComponentConfig, ComponentProps } from '../base';
import { CompilationContext } from '../../types/components';
import { createBaseState  } from 'components/portExpressions';
import { AllPortTypes } from '../../types/portTypes';
import { PortConfiguration } from '../portExpressions';
import { StaticStateDriver } from '../base';
import { midpointRelationship, markNameValue, ComponentPropsFromPorts } from 'components/portUtils';


const datasetValue = (componentId:string)=>{
    return {
       target:'data',
       reference: componentId+"_data"
    }
}

const initRectState = {
    x1: 0,
    y1: 0,
    x2: 1000,
    y2: 1000,

    // Aesthetics 
    strokeDash: [6, 4],
    stroke: 'firebrick',
    strokeWidth: 2,
    strokeOpacity: 0.7,
    fillOpacity: 0.2,
    fill: 'firebrick',

    // Mark Name
    markName: markNameValue
}

const rectStateRef = createBaseState(initRectState);

const portGroup = {
    DEFAULT: 'default',
    X_ONLY: 'x',
    Y_ONLY: 'y',
    MID: 'mid'
};

const [midOutputX, midX1Relationship, midX2Relationship] =
  midpointRelationship('mid_x', rectStateRef.x1, rectStateRef.x2);

const [midOutputY, midY1Relationship, midY2Relationship] =
  midpointRelationship('mid_y', rectStateRef.y1, rectStateRef.y2);

const portConfigurations: PortConfiguration[] = [
    // Default mode - full rect coordinates
    { "port": AllPortTypes.X1, "portGroup": portGroup.DEFAULT, "read": rectStateRef.x1 },
    { "port": AllPortTypes.Y1, "portGroup": portGroup.DEFAULT, "read": rectStateRef.y1 },
    { "port": AllPortTypes.X2, "portGroup": portGroup.DEFAULT, "read": rectStateRef.x2 },
    { "port": AllPortTypes.Y2, "portGroup": portGroup.DEFAULT, "read": rectStateRef.y2 },
    { "port": AllPortTypes.MARK_NAME, "portGroup": portGroup.DEFAULT, "read": rectStateRef.markName, "write": null},
    // { "port": port.width, "portGroup": portGroup.DEFAULT, "read": rectStateRef.x2.subtract(rectStateRef.x1) },
    // { "port": port.height, "portGroup": portGroup.DEFAULT, "read": rectStateRef.y2.subtract(rectStateRef.y1) },
    { "port": AllPortTypes.MID_X, "portGroup": portGroup.MID, "read": midOutputX, "write": [midX1Relationship, midX2Relationship]},
    { "port": AllPortTypes.MID_Y, "portGroup": portGroup.MID, "read": midOutputY, "write": [midY1Relationship, midY2Relationship]},

    { "port": AllPortTypes.X1, "portGroup": portGroup.X_ONLY, "read": rectStateRef.x1 },
    { "port": AllPortTypes.X2, "portGroup": portGroup.X_ONLY, "read": rectStateRef.x2 },
    { "port": AllPortTypes.Y1, "portGroup": portGroup.X_ONLY, "read": false }, // disable reading y values for x only bind
    { "port": AllPortTypes.Y2, "portGroup": portGroup.X_ONLY, "read": false },

    { "port": AllPortTypes.X1, "portGroup": portGroup.Y_ONLY, "read": false },
    { "port": AllPortTypes.X2, "portGroup": portGroup.Y_ONLY, "read": false },
    { "port": AllPortTypes.Y1, "portGroup": portGroup.Y_ONLY, "read": rectStateRef.y1 },
    { "port": AllPortTypes.Y2, "portGroup": portGroup.Y_ONLY, "read": rectStateRef.y2 }
];

export type RectPortConfigurations = typeof portConfigurations;
export type RectProps = ComponentProps<RectPortConfigurations>;

const rectDriver : StaticStateDriver<typeof initRectState> = {
    type: 'static',
    initialState: initRectState
}
export class RectComponent extends BaseComponent {
    constructor(props: RectProps) {
        super({
            componentProps: props,
            portConfigurations: portConfigurations,
            driver: rectDriver
        });
    }

    compile(compilationContext: CompilationContext): any {
        const {x1,y1,x2,y2,data,fill,stroke,strokeWidth,strokeOpacity,fillOpacity,strokeDash,strokeDashOffset} = compilationContext.state;

        return {
            "name":this.id,
            "mark":{"type":"rect","fill":fill,"stroke":stroke,"strokeWidth":strokeWidth,"strokeOpacity":strokeOpacity,"fillOpacity":fillOpacity,"strokeDash":strokeDash,"strokeDashOffset":strokeDashOffset},
            "data":data,
            "encoding":{
                "x":x1,
                "y":y1,
                "x2":x2,
                "y2":y2
            }
        };
    }
} 