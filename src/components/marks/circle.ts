import { BaseComponent } from "../base";
import { Field, isContinuousFieldOrDatumDef } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import {compilationContext} from '../../binding/binding';
import { AnchorProxy, AnchorIdentifer } from "../../types/anchors";

import { generateSignalFromAnchor, createRangeAccessor } from "../utils";
import { extractSignalNames } from "../../binding/mergedComponent_CLEAN";

export const circleBaseContext: Record<AnchorIdentifer, any> = {
    x: 0,
    y: 0,
    size: 200,
    color: "'red'", // in vega, color needs to be a string in the expression
    stroke: "'white'", 
    data: {"values":[{ "val1":"val2"}]} // Empty data array to only render one mark
}

type CircleConfig = {
    [K in keyof typeof circleBaseContext]?: typeof circleBaseContext[K]
}

export class Circle extends BaseComponent {
    public config: CircleConfig;
    static bindableProperties = ['x', 'y', 'size', 'color', 'stroke'] as const;

    constructor(config:CircleConfig={}){
        super({...config})

        this.schema = {
            'x': {
                container: 'Scalar',
                valueType: 'Numeric'
            },
            'y': {
                container: 'Scalar',
                valueType: 'Numeric'
            }
        }

        this.anchors.set('x', this.createAnchorProxy({'x':this.schema['x']}, 'x', () => {
            return {value: `${this.id}_x`}
        }));
        this.anchors.set('y', this.createAnchorProxy({'y':this.schema['y']}, 'y', () => {
            return {value: `${this.id}_y`}
        }));

        this.config = config;
        this.initializeAnchors();
    }

    compileComponent(inputContext:compilationContext): Partial<UnitSpec<Field>> {
        const nodeId = inputContext.nodeId || this.id;
        
        // TODO handle missing key/anchors
        const outputSignals = Object.keys(this.schema).map(key => 
            generateSignalFromAnchor(inputContext[key] || [], key, this.id, nodeId, this.schema[key].container)
        ).flat();

        // if there is an inputContext key that ends with _internal, then
            // extract the channel from it {channel}_internal

        const internalSignals = Object.keys(inputContext).filter(key => key.endsWith('_internal')).map(key => 
            inputContext[key].map((updateStatement:string) => {
                const channel = key.replace('_internal', '')
                const signal = generateSignalFromAnchor(['SIGNALVAL'],key,this.id,nodeId,this.schema[channel].container)[0]
                return {
                name: this.id+'_'+key,
                "on": [{
                    "events": {
                        "signal": this.id
                    },
                    "update": updateStatement.replace(/VGX_SIGNAL_NAME/g, `${this.id}_${key}`)
                }]
            }
        })).flat();

        
        return {
            params: [
                {
                    "name": this.id,
                    "value": circleBaseContext,
                },
                ...outputSignals,
                ...internalSignals
            ],
            data: inputContext.data || circleBaseContext.data,
            mark: {
                type: "circle",
                name: `${this.id}_marks`
            },
            "encoding": {
                "x": {
                    "value": {"expr": `${this.id}_x`},
                },
                "y": {
                    "value": {"expr": `${this.id}_y`},
                },
                "size": {
                    "value": {"expr": inputContext.size || circleBaseContext.size}
                },
                "color": {
                    "value": {"expr": inputContext.color || circleBaseContext.color}
                },
                "stroke": {
                    "value": {"expr": inputContext.stroke || circleBaseContext.stroke}
                }
            }
        }
    }
}