import { BaseComponent, ComponentConfig, ComponentProps, ConfigurationEdge, EventsStateDriver } from '../base';
import { CompilationContext, DerivedDataConfig } from '../../types/components';
import { AllPortTypes } from '../../types/portTypes';
import { createBaseState } from '../portExpressions';
import { PortConfiguration } from '../portExpressions';
import { ComponentPropsFromPorts } from 'components/portUtils';

// First, define the base state
const initDragState = {
    // Position tracking
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    stopX: 0,
    stopY: 0,

};

const dragStateRef = createBaseState(initDragState);

// Port Groups
const portGroup = {
    DEFAULT: 'default',    // Current position
    SPAN: 'span',         // Start to end span
    ON_END: 'onEnd'       // Final position after drag
};

// Port Configurations
const portConfigurations: PortConfiguration[] = [
    // Default mode - current position
    { 
        port: AllPortTypes.X, 
        portGroup: portGroup.DEFAULT, 
        read: dragStateRef.currentX
    },
    { 
        port: AllPortTypes.Y, 
        portGroup: portGroup.DEFAULT, 
        read: dragStateRef.currentY
    },

    // Span mode - start to end coordinates
    { 
        port: AllPortTypes.X1, 
        portGroup: portGroup.SPAN, 
        read: dragStateRef.startX
    },
    { 
        port: AllPortTypes.Y1, 
        portGroup: portGroup.SPAN, 
        read: dragStateRef.startY
    },
    { 
        port: AllPortTypes.X2, 
        portGroup: portGroup.SPAN, 
        read: dragStateRef.currentX
    },
    { 
        port: AllPortTypes.Y2, 
        portGroup: portGroup.SPAN, 
        read: dragStateRef.currentY
    },

    // OnEnd mode - final position
    { 
        port: AllPortTypes.X1, 
        portGroup: portGroup.ON_END, 
        read: dragStateRef.startX
    },
    { 
        port: AllPortTypes.Y1, 
        portGroup: portGroup.ON_END, 
        read: dragStateRef.startY
    },
    { 
        port: AllPortTypes.X2, 
        portGroup: portGroup.ON_END, 
        read: dragStateRef.stopX
    },
    { 
        port: AllPortTypes.Y2, 
        portGroup: portGroup.ON_END, 
        read: dragStateRef.stopY
    }
];

export type DragPortConfigurations = typeof portConfigurations;
export type DragProps = ComponentProps<DragPortConfigurations>;

// Expression driver for handling drag state updates
// 
const dragDriver: EventsStateDriver<typeof initDragState> = {
    type: 'events',
    initialState: initDragState,
    //@ts-ignore, these are valid event types
    events: {
        "pointerdown": (nodeId: string )=> {
            return `{
                startX: x(),
                startY: y()
            }`
        },
        "pointermove": (nodeId: string )=> {    
            return `merge(${nodeId}, {
                currentX: x(),
                currentY: y()
            })`
        },
        "pointerup": (nodeId: string )=> {
            return `{
                stopX: x(),
                stopY: y()
            }`
        }
    }
};


type DragConfig = {
 startX: number;
 startY: number;
 currentX: number;
 currentY: number;
 stopX: number;
 stopY: number;
}
function extractConfigEdges(props: DragConfig, ports: PortConfiguration[]): ConfigurationEdge[] {
    const initialEdges: ConfigurationEdge[] = [];

    
    // Only extract configurations for ports
    for (const port of ports) {
        const portName = port.port;
        const portGroup = port.portGroup;
        const key = portGroup === 'default' ? portName : `${portGroup}.${portName}`;
        
        if (key in props) {
            initialEdges.push({
                portName,
                portGroup,
                value: props[key as keyof DragConfig]
            });
        }
    }
    return initialEdges;
}
export class DragComponent extends BaseComponent {
    constructor(props: DragProps) {
        super({
            componentProps: props,
            portConfigurations: portConfigurations,
            driver: dragDriver
        });
    }

    compile(compilationContext: CompilationContext): any {
        const {startX, startY, currentX, currentY, stopX, stopY, stroke, strokeWidth, strokeOpacity} = compilationContext.state;

        const markName = this.id;
        const signal = {
            name: this.id,
            value: initDragState,
            on: [
                { 
                    events: { type: 'pointerdown', markname: markName }, 
                    update: dragDriver.events.pointerdown(this.id)
                },
                {
                    events: {
                        type: 'pointermove',
                        source: 'window',
                        between: [
                            { type: 'pointerdown', markname: markName },
                            { type: 'pointerup', source: 'window' }
                        ]
                    },
                    update: dragDriver.events.pointermove(this.id)
                },
                {
                    events: { type: 'pointerup', source: 'window' },
                    update: dragDriver.events.pointerup(this.id)
                }
            ]
        };

        return {
            name: this.id,
            signal: signal,
            state: compilationContext.state
        };
    }
} 