
// 


//Rect brush is defined as [x1,x2,y1,y2]



import { BaseComponent } from "../base";
import { Field, isContinuousFieldOrDatumDef } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import {compilationContext} from '../../binding/binding';
import { AnchorProxy, AnchorType } from "types/anchors";
import { generateAnchorsFromContext } from "../../utils/anchorProxy";
import { generateComponentSignalName } from "../../utils/component";
import { generateParams } from "../../utils/compilation";

export const brushBaseContext: Record<AnchorType, any> = {
    x: null,
    y: null,
    color: "'transparent'", // in vega, color needs to be a string in the expression
    stroke: "'firebrick'", 
    data: {"values":[{ }]} // Empty data array to only render one mark
}

type BrushConfig = {
    [K in keyof typeof brushBaseContext]?: typeof brushBaseContext[K]
}


// point.x -> {xVal}
// brush.x -> (x1,x2)
// lasso.x -> [x,x,x,x,x,x,x,x,x,x]
//lasso.x.bind(vgx.drag_point)// each one should constraint the drag point to the lasso value 
// when 

// creates, arrays of params. 
// brush.x.bind(vgx.line) 
// constraint()
/* 
Brush.x-> [x1,x2]


*/

function generateSides() {

}

function generateRectProperties(){
    return ['']
}

export class Brush extends BaseComponent {
    public config: BrushConfig;
    static bindableProperties = ['x', 'y', 'size', 'color', 'stroke'] as const;

    constructor(config:BrushConfig={}){
        super({...config})
        this.anchors = generateAnchorsFromContext(config, circleBaseContext,this);

        Circle.bindableProperties.forEach(prop => {
            if (config[prop] !== undefined) {
                this.addContextBinding(prop, config[prop]);
            }
        });
        
        Object.entries(circleBaseContext).forEach(([key, value]) => {
            if (config[key as keyof CircleConfig] === undefined) {
                this.addContextBinding(key, value, 'baseContext');
            }
        });


        this.config = config;
        this.initializeAnchors()
         
    }

    

    compileComponent(inputContext:compilationContext): Partial<UnitSpec<Field>> {
        return {
            // add param which will always be the value for this component
            "params":[{
                "name":`${inputContext.nodeId}_brush`,
                //@ts-ignore, this is acceptable because params can take expr strings
                "select":{"type":"interval"}
            },{
                "name":generateComponentSignalName(inputContext.nodeId),
                //@ts-ignore, this is acceptable because params can take expr strings
                "expr":`{'x':${inputContext.x.fieldValue},'y':${inputContext.y.fieldValue}}`
            }],
            "data":inputContext.data || brushBaseContext.data,
            "mark":{
                "type":"circle",
                "x": {
                    "expr": `clamp(${inputContext.x.fieldValue}, ${inputContext.x.scale}range.min, ${inputContext.x.scale}range.max)`
                },
                "y": {
                    // remember that y needs to be inverted (lower is higher)
                    "expr": `clamp(${inputContext.y.fieldValue}, ${inputContext.y.scale}range.min, ${inputContext.y.scale}range.max)`
                },
                "color": {
                    "expr": inputContext.color || brushBaseContext.color
                },
                stroke: {
                    "expr": inputContext.stroke || brushBaseContext.stroke
                }
            }
        }
    }
}