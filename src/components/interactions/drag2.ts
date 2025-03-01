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
            console.log('in binding scales!')
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

export class DragSpan extends BaseComponent {
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
}

type constrain_expr = string;
// context: a mapping of property names to constraint expressions
type CompilationContext = Record<string, constrain_expr[]>;
// markName : "update": "mark_0_layer_marks "// scalar, just map 

const generateSignalFromSchema = (schema: SchemaType, channel: string, signalParent:string,mergedParent:string) => {

    return {
        name: mergedParent+'_'+channel,
        value: null,
        on: [{
            events: {
               signal: signalParent,
            },
            update: schema.extractors[channel]?.update.replace('VGX_SIGNAL_NAME', signalParent)
        }]
    }
}
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

    
        function generateCompiledValue(channel:string){
            return {
                'value': `VGX_SIGNAL_NAME_${channel}`, // min value
            }
        }
         
    
          this.anchors.set('x', this.createAnchorProxy({'x':this.schema['x']}, 'x', () => {
            console.log('in binding scales!')
            return generateCompiledValue('x')
          }));

          this.anchors.set('y', this.createAnchorProxy({'y':this.schema['y']}, 'y', () => {
            console.log('in binding scales!')
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
                    between: [
                        { type: "pointerdown", "markname": inputContext.markName},
                        { type: "pointerup" }
                    ]
                },
                update: `merge(${nodeId}, {'x': x(), 'y': y()})`
            }]
        }; // drag_x, drag_y

        // 

        function generateSignalFromAnchor(constraints:string[],channel: string, signalParent:string,mergedParent:string) {
            // const compilationValue = anchor.compile();
            const parentExtractor = signalParent+"."+channel
            const signalName = mergedParent+'_'+channel;
            console.log("CONSTRAINTS",constraints)


            const generateConstraints = (update:string)=>{
                return {
                    events: {
                        signal: signalName
                    },
                    update: update.replace('VGX_SIGNAL_NAME',signalName)
                }
            }

            return {
                name: signalName,
                value: null,
                on: [{
                    events: [{
                        signal: signalParent
                    }],
                    update: parentExtractor
                }, ...(constraints.map(generateConstraints))]
            }
            //Example out:
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
        
       


        console.log('schewma',this.schema, Object.keys(this.schema))

        // TODO handle missing key/anchors
        const outputSignals = Object.keys(this.schema).map(key => generateSignalFromAnchor(inputContext[key] || [], key, this.id, nodeId))
        // then , may through each item

        return {
            //@ts-ignore as signals can exist in VL
            params: [signal, ...outputSignals]

        };
    }
}
