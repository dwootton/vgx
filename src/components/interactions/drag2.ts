import { BaseComponent } from "../base";
import { Field } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import { compilationContext } from '../../binding/binding';
import { generateAnchorsFromContext } , SchemaTypefrom "../../utils/anchorProxy";
import { generateComponentSignalName } from "../../utils/component";
import { generateParams } from "../../utils/compilation";
import { SchemaType, NumericScalar, AnchorProxy } from "../../types/anchors";
export const dragBaseContext = {

}

const currentExtractor = (channel: string) => ({
    type: 'Scalar',
    channel: channel,
    update: `VGX_SIGNAL_NAME.${channel}`
});

const rangeExtractor = (channel: string) => ({
    type: 'Range',
    channel: channel,   
    update: `{
        start: VGX_SIGNAL_NAME.start.${channel},
        stop: VGX_SIGNAL_NAME.stop.${channel}
    }`
});

const startExtractor = (channel: string) => ({
    type: 'Scalar',
    channel: channel,
    update: `VGX_SIGNAL_NAME.start.${channel}`
});

// x has encoding schema, y has encoding schema 
// top -> x1+y1, y1 => implies this must be a point, so for now lets limit it to only one interactor schema per bind
// 



// inputs: 
// element: string

// schema 
    // span: 
        // schema: range
        // // events: 
        
        // {
        //         events: {
        //             type: 'pointermove',
        //             between: [
        //                 { type: "pointerdown", "markname": inputContext.markName},
        //                 { type: "pointerup" }
        //             ]
        //         },
        //         update: `merge(${nodeId}, {'x': x(), 'y': y() })`
        //     },

// any encoding types will compile down to 

// brush.top, this is a anchor for dragspan(y,x) and 
// when a new anchorname is bound, check top level anchor properties
    // then if not, check the generated anchors from each schema. 

// anchornames are generated via taking in both schema types (x,y)
// 



export class DragStart extends BaseComponent {
    constructor(config: any = {}) {
        super(config);

        this.schema = {
            'x': {
                container: 'Scalar',
                valueType: 'Numeric'
            }
        }

        // this.schemas = [{
        //     schemaId: 'start',
        //     schemaType: 'Scalar',
        //     extractors: {'x':startExtractor('x'), 'y':startExtractor('y')}
        // }];

        this.initializeAnchors();
        
        const numericTypes = {
            'x': NumericScalar, // min value
          }
    
          const compiledValue = {
            'value': `COMPONENT_NAME.x`, // min value
          }
    
          this.anchors.set('x', this.createAnchorProxy(numericTypes, 'x', () => {
            return compiledValue
          }));
         
          
    }

    compileComponent(inputContext: compilationContext): Partial<UnitSpec<Field>> {
        const nodeId = inputContext.nodeId || this.id;
        const signal = {
            name: this.id,
            value: dragBaseContext,
            on: [{
                "events": {
                    "type": "pointerdown",
                    "markname": inputContext.markName
                },
                "update": `merge(${nodeId}, {'x':x(),'y':y()})`
            }]
        };

        return {
            params: [signal, generateSignalFromSchema(this.schemas[0], 'x', this.id, nodeId), generateSignalFromSchema(this.schemas[0], 'y', this.id, nodeId )]
        };
    }
}

/*export class DragSpan extends BaseComponent {
    public schemas: InteractorSchema[];
    constructor(config: any = {}) {
        super(config);

        this.schemas = [{
            schemaId: 'span',
            schemaType: 'Range',
            extractors: {'x':rangeExtractor('x'), 'y':rangeExtractor('y')}
        }];

        this.initializeAnchors();
    }

    compileComponent(inputContext: compilationContext): Partial<UnitSpec<Field>> {
        const nodeId = inputContext.nodeId || this.id;
        const signal = {
            name: this.id,
            value: dragBaseContext,
            on: [{
                events: {
                    type: 'pointermove',
                    between: [
                        { type: "pointerdown", "markname": inputContext.markName},
                        { type: "pointerup" }
                    ]
                },
                update: `merge(${nodeId}, {'start': {'x': x(), 'y': y()}, 'stop': {'x': x(), 'y': y()}})`
            }]
        };

        return {
            params: [signal, generateSignalFromSchema(this.schemas[0], 'x', this.id, nodeId), generateSignalFromSchema(this.schemas[0], 'y', this.id, nodeId )]
        };
    }
}*/

type constrain_expr = string;
// context: a mapping of property names to constraint expressions
type CompilationContext = Record<string, constrain_expr[]>;
// markName : "update": "mark_0_layer_marks "// scalar, just map 

// const generateSignalFromSchema = (schema: SchemaType, channel: string, signalParent:string,mergedParent:string) => {

//     return {
//         name: mergedParent+'_'+channel,
//         value: null,
//         on: [{
//             events: {
//                signal: signalParent,
//             },
//             update: schema.extractors[channel]?.update.replace('VGX_SIGNAL_NAME', signalParent)
//         }]
//     }
// }


export class Drag extends BaseComponent {
    constructor(config: any = {}) {
        super(config);

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
            return generateCompiledValue('x')
          }));

          this.anchors.set('y', this.createAnchorProxy({'y':this.schema['y']}, 'y', () => {
            return generateCompiledValue('y')
          }));

    }

    compileComponent(inputContext: CompilationContext): Partial<UnitSpec<Field>> {
        const nodeId = inputContext.nodeId || this.id;
        const signal = {
            name: this.id, // base signal
            value: dragBaseContext,
            on: [{
                events: {
                    type: 'pointermove',
                    source:"window",
                    between: [
                        { type: "pointerdown", "markname": inputContext.markName},
                        { type: "pointerup",    source:"window", }
                    ]
                },
                update: `merge(${nodeId}, {'x': x(), 'y': y()})`
            }]
        }; 
       
        // TODO handle missing key/anchors
        const outputSignals = Object.keys(this.schema).map(key => generateSignalFromAnchor(inputContext[key] || [], key, this.id, nodeId))
        // then , may through each item

        return {
            //@ts-ignore as signals can exist in VL
            params: [signal, ...outputSignals]

        };
    }
}


export class DragSpan extends BaseComponent {
    constructor(config: any = {}) {
        super(config);

        // this.schemas = [{
        //     schemaId: 'span',
        //     schemaType: 'Range',
        //     extractors: {'x':rangeExtractor('x'), 'y':rangeExtractor('y')}
        // }];

        console.log('in DragSpan constructor')
        this.schema = {
            'x': {
                container: 'Range',
                valueType: 'Numeric'
            },
            // 'y': {
            //     container: 'Range',
            //     valueType: 'Numeric'
            // }
        }

    
     
        function generateCompiledRange(channel:string){
            console.log('in generateCompiledRange', channel)
            return {
                'start': `VGX_SIGNAL_NAME_${channel}.start`,
                'stop': `VGX_SIGNAL_NAME_${channel}.stop`,
            }
        }
        
         
    
          this.anchors.set('x', this.createAnchorProxy({'x':this.schema['x']}, 'x', () => {
            console.log('in binding scales!')
            return generateCompiledRange('x')
          }));

        //   this.anchors.set('y', this.createAnchorProxy({'y':this.schema['y']}, 'y', () => {
        //     console.log('in binding scales!')
        //     return generateCompiledValue('y')
        //   }));

    }

    compileComponent(inputContext: CompilationContext): Partial<UnitSpec<Field>> {
        const nodeId = inputContext.nodeId || this.id;
        const signal = {
            name: this.id,
            value: dragBaseContext,
            on: [{
                events: {
                    type: 'pointermove',
                    source:"window",
                    between: [
                        { type: "pointerdown", "markname": inputContext.markName},
                        { type: "pointerup",    source:"window", }
                    ]
                },
                // update: `merge(${nodeId}, {'start': {'x': x(), 'y': y()}, 'stop': {'x': x(), 'y': y()}})`
                update: `{'x':merge(${this.id}.x, {'stop':x()}), 'y':merge(${this.id}.y, {'stop':y()})}`

            },{
                events: {
                     type: "pointerdown", "markname": inputContext.markName,
                },
                // update: `merge(${nodeId}, {'start': {'x': x(), 'y': y()}, 'stop': {'x': x(), 'y': y()}})`
                update: `{'x':{'start':x()},'y':{'start':y()}}`
            }]
        };
      
       
        // TODO handle missing key/anchors
        const outputSignals = Object.keys(this.schema).map(key => 
            generateSignalFromAnchor(inputContext[key] || [], key, this.id, nodeId, this.schema[key].container)
        ).flat();
        // then , may through each item

        return {
            //@ts-ignore as signals can exist in VL
            params: [signal, ...outputSignals]

        };
    }
}

function generateCompiledValue(channel:string){
    return {
        'value': `VGX_SIGNAL_NAME_${channel}`, // min value
    }
}

function generateSignalFromAnchor(constraints:string[], channel: string, signalParent:string, mergedParent:string, schemaType: string): any[] {
    // For Scalar type
    if (schemaType === 'Scalar') {
        const parentExtractor = signalParent + "." + channel;
        const signalName = mergedParent + '_' + channel;
        console.log("CONSTRAINTS", constraints);

        const generateConstraints = (update:string) => {
            return {
                events: {
                    signal: signalName
                },
                update: update.replace(/VGX_SIGNAL_NAME/g, signalName)
            }
        };

        return [{
            name: signalName,
            value: null,
            on: [{
                events: [{
                    signal: signalParent
                }],
                update: parentExtractor
            }, ...(constraints.map(generateConstraints))]
        }];
    }
    // For Range type
    else if (schemaType === 'Range') {
        const startSignalName = mergedParent + '_' + channel + '_start';
        const stopSignalName = mergedParent + '_' + channel + '_stop';
        
        const startParentExtractor = signalParent + "." + channel + ".start";
        const stopParentExtractor = signalParent + "." + channel + ".stop";
        
        const generateStartConstraints = (update:string) => {
            return {
                events: {
                    signal: startSignalName
                },
                update: `${startSignalName} ? ${update.replace(/VGX_SIGNAL_NAME/g, startSignalName)}:${startSignalName} `
            }
        };
        
        const generateStopConstraints = (update:string) => {
            return {
                events: {
                    signal: stopSignalName
                },
                update: `${stopSignalName} ? ${update.replace(/VGX_SIGNAL_NAME/g, stopSignalName)}:${stopSignalName} `
            }
        };
        
        return [
            {
                name: startSignalName,
                value: null,
                on: [{
                    events: [{
                        signal: signalParent
                    }],
                    update: startParentExtractor
                }, ...(constraints.map(generateStartConstraints))]
            },
            {
                name: stopSignalName,
                value: null,
                on: [{
                    events: [{
                        signal: signalParent
                    }],
                    update: stopParentExtractor
                }, ...(constraints.map(generateStopConstraints))]
            }
        ];
    }
    
    // Default case (should not happen if schema is properly defined)
    console.warn(`Unknown schema type: ${schemaType} for channel ${channel}`);
    return [];
}
    // const drag_x = {
        //     name:"drag_x",
        //     value: null,
        //     on: [{
        //         events: {
        //             signal: this.id
        //         },
        //         update: `${this.id}.x`
        //     },{
        //         events: {
        //             signal: "drag_x"
        //         },
        //         update: `clamp('drag_x', ${range0}, ${range1})`
        //     }]
        // }
}
