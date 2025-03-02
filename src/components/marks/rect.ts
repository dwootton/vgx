import { BaseComponent } from "../base";
import { Field, isContinuousFieldOrDatumDef } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import {compilationContext} from '../../binding/binding';
import { AnchorProxy, AnchorIdentifer } from "types/anchors";
import { generateAnchorsFromContext } from "../../utils/anchorProxy";
import { generateComponentSignalName } from "../../utils/component";
import { generateParams } from "../../utils/compilation";

export const rectBaseContext: Record<AnchorIdentifer, any> = {
    x1: null,
    x2: null,
    y1: null,
    y2: null,
    size: 200,
    color: "'red'", // in vega, color needs to be a string in the expression
    stroke: "'white'", 
    data: {"values":[{ "val1":"val2"}]} // Empty data array to only render one mark
}

console.log('in rect.ts')
type RectConfig = {
    [K in keyof typeof rectBaseContext]?: typeof rectBaseContext[K]
}

export class Rect extends BaseComponent {

    constructor(config:RectConfig={}){
        super({...config})

        console.log('in rect constructor')
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

        // when rect is the parent, how does its child get this value?
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
          this.anchors.set('y', this.createAnchorProxy({'y':this.schema['y']}, 'y', () => {
            console.log('in binding scales!')
            return generateCompiledRange('y')
          }));
         
    }

   

    

    compileComponent(inputContext:compilationContext): Partial<UnitSpec<Field>> {
        console.log('in rect compileComponent',inputContext)
       
        return {
            params: [
            //     {
            //     "name":this.id,
            //     //@ts-ignore
            //     "expr":`{'x':{'start':${inputContext.x.start},'stop':${inputContext.x.stop}},'y':{'start':${inputContext.y.start},'stop':${inputContext.y.stop}}}`
            // }
            //     {
            //     // name: generateComponentSignalName(inputContext.nodeId),
            //     // //@ts-ignore, this is acceptable because params can take expr strings
            //     // expr: `{
            //     //     x1: ${inputContext.x1.fieldValue},
            //     //     x2: ${inputContext.x2.fieldValue},
                  
            //     // }`
            //     //  y1: ${inputContext.y1.fieldValue},
            //     //y2: ${inputContext.y2.fieldValue}
            // }
        ],
            data: inputContext.data || rectBaseContext.data,
            mark: {
                type: "rect",
                x: { 
                    expr:  "50"//inputContext.x.start
                },
                x2: {
                    expr:   "100"//inputContext.x.stop
                },
                y: {
                    expr:  "50"//inputContext.y.start
                },
                y2: {
                    expr:  "100"//inputContext.y.stop
                },
                color: {
                    expr: inputContext.color || rectBaseContext.color
                },
                stroke: {
                    expr: inputContext.stroke || rectBaseContext.stroke
                }
            }
        }
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
            'y': {
                container: 'Range',
                valueType: 'Numeric'
            }
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
          this.anchors.set('y', this.createAnchorProxy({'y':this.schema['y']}, 'y', () => {
            console.log('in binding scales!')
            return generateCompiledRange('y')
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