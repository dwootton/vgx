import { BaseComponent } from "../base";
import { Field, isContinuousFieldOrDatumDef } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import {compilationContext} from '../../binding/binding';
import { AnchorProxy, AnchorIdentifer } from "types/anchors";
import { generateAnchorsFromContext } from "../../utils/anchorProxy";
import { generateComponentSignalName } from "../../utils/component";
import { generateParams } from "../../utils/compilation";
import { generateSignalFromAnchor, createRangeAccessor } from "../utils";
export const rectBaseContext: Record<AnchorIdentifer, any> = {
   "x":{
    start: 0,
    stop: 1000
   },
   "y":{
    start: 0,
    stop: 1000
   },
    size: 200,
    color: "'red'", // in vega, color needs to be a string in the expression
    stroke: "'white'", 
    data: {"values":[{ "val1":"val2"}]} // Empty data array to only render one mark
}

type RectConfig = {
    [K in keyof typeof rectBaseContext]?: typeof rectBaseContext[K]
}

export class Rect extends BaseComponent {

    constructor(config:RectConfig={}){
        super({...config})

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

   

    

    compileComponent(inputContext:compilationContext): Partial<UnitSpec<Field>> {
        const nodeId = inputContext.nodeId || this.id;
        // in previous examples, I've needed to construct signals. But technically we should have the right info...

 // TODO handle missing key/anchors
        const outputSignals = Object.keys(this.schema).map(key => 
            generateSignalFromAnchor(inputContext[key] || [], key, this.id, nodeId, this.schema[key].container)
        ).flat();
       
        return {
            params: [
                {
                    "name":this.id,
                    "value":rectBaseContext,
                    // "expr":`{'x':{'start':${outputSignals[0].name},'stop':${outputSignals[1].name}},y:{'start':${outputSignals[2].name},'stop':${outputSignals[3].name}}}`
                },
                ...outputSignals
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
                // x: { 
                //     expr:  `${this.id}_x_start`
                // },
                // x2: {
                //     expr:   `${this.id}_x_stop`
                // },
                // y: {
                //     expr:  `${this.id}_y_start`
                // },
                // y2: {
                //     expr:  `${this.id}_y_stop`
                // },
                // color: {
                //     expr: inputContext.color || rectBaseContext.color
                // },
                // stroke: {
                //     expr: inputContext.stroke || rectBaseContext.stroke
                // }
            },
            "encoding":{
                "x":{
                    "value":{"expr":`${this.id}_x_start`},
                    //"type":"quantitative"
                },
                "x2":{
                    "value":{"expr":`${this.id}_x_stop`},
                    //"type":"quantitative"
                },
                "y":{
                    "value":{"expr":`${this.id}_y_start`},
                    //"type":"quantitative"
                },
                "y2":{
                    "value":{"expr":`${this.id}_y_stop`},
                    //"type":"quantitative"
                }
            }
        }
    }
}




