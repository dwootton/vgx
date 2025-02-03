
// 


//Rect brush is defined as [x1,x2,y1,y2]


// TODO fix issue
import { BaseComponent } from "../base";
import { Field } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import {compilationContext} from '../../binding/binding';
import {  AnchorType } from "types/anchors";
import { generateAnchorsFromContext } from "../../utils/anchorProxy";
import { generateComponentSignalName } from "../../utils/component";

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
        this.anchors = generateAnchorsFromContext(config, brushBaseContext,this);

        Brush.bindableProperties.forEach(prop => {
            if (config[prop] !== undefined) {
                this.addContextBinding(prop, config[prop]);
            }
        });
        
        Object.entries(brushBaseContext).forEach(([key, value]) => {
            if (config[key as keyof BrushConfig] === undefined) {
                this.addContextBinding(key, value, 'baseContext');
            }
        });


        this.config = config;
        this.initializeAnchors()
        console.log('made brush!',this)
         
    }

    // generation of the brush signal should come from binding. That is, we should not create and use it in here. 
    

    compileComponent(inputContext:compilationContext): Partial<UnitSpec<Field>> {
        console.log('compiling brush')
        //TODO split rect into 4 sides such that we can do this like bind x sides diff than y sides...
        const brushName = `${inputContext.nodeId}_brush`;

        // brush but then change the movement of it?

        const signalName = generateComponentSignalName(inputContext.nodeId)

        return {
            // add param which will always be the value for this component
            "params":[{
                "name":`${brushName}`, // TODO, move this up to the corresponding chart spec
                "select":{"type":"interval", "mark":undefined}
            },{
                "name":generateComponentSignalName(inputContext.nodeId),
                //TODO handle unidimensional or other channel brushes!!!!
                //@ts-ignore, this is acceptable because params can take expr strings
                // "expr":`{'x':${brushName}_x[0],'x2':${brushName}_x[1],'y':'x2':${brushName}_y[1],'y2':${brushName}_y[1]}`
                "expr":`{'x':${brushName}_x[0],'x2':${brushName}_x[1]}`
            }],
            "data":inputContext.data || brushBaseContext.data,
            "mark":{
                "type":"rect",
                "x": {
                    "expr": `clamp(${signalName}.x, ${inputContext.x.scale}range.min, ${inputContext.x.scale}range.max)`
                },
                "x2": {
                    // remember that y needs to be inverted (lower is higher)
                    "expr": `clamp(${signalName}.x2, ${inputContext.y.scale}range.min, ${inputContext.y.scale}range.max)`
                },
                // "y": {
                //     "expr": `clamp(${signalName}.y, ${inputContext.x.scale}range.min, ${inputContext.x.scale}range.max)`
                // },
                // "y2": {
                //     // remember that y needs to be inverted (lower is higher)
                //     "expr": `clamp(${signalName}.y2, ${inputContext.y.scale}range.min, ${inputContext.y.scale}range.max)`
                // },
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