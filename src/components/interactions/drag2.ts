import { BaseComponent } from "../base";
import { Field } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import { compilationContext } from '../../binding/binding';
import { generateComponentSignalName } from "../../utils/component";
import { generateParams } from "../../utils/compilation";
import { SchemaType, NumericScalar, AnchorProxy } from "../../types/anchors";
import { generateCompiledValue, generateSignalFromAnchor, createRangeAccessor } from "../utils";
export const dragBaseContext = {"x":{"start":1,"stop":100},"y":{"start":1,"stop":100}},

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
                valueType: 'Numeric',
                interactive: true
            },
            'y': {
                container: 'Scalar',
                valueType: 'Numeric',
                interactive: true
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
        const outputSignals = Object.keys(this.schema).map(key => generateSignalFromAnchor(inputContext[key] || [], key, this.id, nodeId, this.schema[key].container))
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

        this.schema = {
            'x': {
                container: 'Range',
                valueType: 'Numeric'
            },
            'y': {
                container: 'Range',
                valueType: 'Numeric'
            }
        }

       
    
          this.anchors.set('x', this.createAnchorProxy({'x':this.schema['x']}, 'x', () => {
            return createRangeAccessor(this.id,'x')
          }));
          this.anchors.set('y', this.createAnchorProxy({'y':this.schema['y']}, 'y', () => {
            return createRangeAccessor(this.id,'y')
          }));

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
                update: `{'x':merge(${this.id}.x, {'stop':x()}), 'y':merge(${this.id}.y, {'stop':y()})}`

            },{
                events: {
                     type: "pointerdown", "markname": inputContext.markName,
                },
                update: `{'x':{'start':x()},'y':{'start':y()}}`
            }]
        };
      
       
        // TODO handle missing key/anchors
        const outputSignals = Object.keys(this.schema).map(key => 
            generateSignalFromAnchor(inputContext[key] || [], key, this.id, nodeId, this.schema[key].container)
        ).flat()

        return {
            //@ts-ignore as signals can exist in VL
            params: [signal, ...outputSignals]

        };
    }
}
