import { BaseComponent } from "../base";
import { Field } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import { compilationContext } from '../../binding/binding';
import { generateAnchorsFromContext } from "../../utils/anchorProxy";
import { generateComponentSignalName } from "../../utils/component";
import { generateParams } from "../../utils/compilation";
import { InteractorSchema, NumericScalar } from "../../types/anchors";
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


import {EncodingValues} from "types/anchors";

function gen(){
    const anchors = []


    const encodingProxy = Object.entries(this.spec.encoding).reduce((acc, [key]) => {
        if (key === scaleName) {
          acc[key] = RangeSchema;
        } else {
          acc[key] = NumericScalar;
        }
        return acc;
      }, {} as Record<string, SchemaType>);

      
      console.log('encoding',encodingProxy);

     
      
      // Scalar
      const compiledAnchor = Object.entries(this.spec.encoding).reduce((acc, [key]) => {
        if (key === scaleName) { // this is a range, so how do I 
          acc[key] = {
            'start': `range('${scaleName}')[0]`,
            'stop': `range('${scaleName}')[1]`,
          };
        } else { // this is scalar, numeric
          acc[key] = {
            'value': `range('${scaleName}')[0]`, // min value
          };
        }
        return acc;
      }, {} as Record<string, AllValues>);
      
     


}

export class DragStart extends BaseComponent {
    public schemas: InteractorSchema[];
    constructor(config: any = {}) {
        super(config);

        this.schemas = [{
            schemaId: 'start',
            schemaType: 'Scalar',
            extractors: {'x':startExtractor('x'), 'y':startExtractor('y')}
        }];

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

const generateSignalFromSchema = (schema: InteractorSchema, channel: string, signalParent:string,mergedParent:string) => {
    console.log(schema.extractors[channel]?.update.replace('VGX_SIGNAL_NAME', signalParent))    

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
    public schemas: InteractorSchema[];
    constructor(config: any = {}) {
        super(config);

        this.schemas = [{
            schemaId: 'current',
            schemaType: 'Scalar', 
            extractors: {'x':currentExtractor('x'), 'y':currentExtractor('y')}
        }];

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
                events: {
                    type: 'pointermove',
                    between: [
                        { type: "pointerdown", "markname": inputContext.markName},
                        { type: "pointerup" }
                    ]
                },
                update: `merge(${nodeId}, {'x': x(), 'y': y()})`
            }]
        };

        return {
            params: [signal, generateSignalFromSchema(this.schemas[0], 'x', this.id, nodeId), generateSignalFromSchema(this.schemas[0], 'y', this.id, nodeId )]

        };
    }
}
