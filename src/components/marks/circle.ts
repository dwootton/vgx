import { BaseComponent } from "../base";
import { Field, isContinuousFieldOrDatumDef } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import {compilationContext} from '../../binding/binding';
import { AnchorProxy, AnchorIdentifer } from "types/anchors";
import { generateAnchorsFromContext } from "../../utils/anchorProxy";
import { generateComponentSignalName } from "../../utils/component";
import { generateParams } from "../../utils/compilation";

export const circleBaseContext: Record<AnchorIdentifer, any> = {
    x: null,
    y: null,
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
        this.anchors = generateAnchorsFromContext(circleBaseContext,this);

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

        this.addContextBinding('markName', this.id+"_marks", 'baseContext');


        this.config = config;
        this.initializeAnchors()
         
    }

    

    compileComponent(inputContext:compilationContext): Partial<UnitSpec<Field>> {
        return {
            // add param which will always be the value for this component
            "params":[{
                "name":generateComponentSignalName(inputContext.nodeId),
                //@ts-ignore, this is acceptable because params can take expr strings
                "expr":`{'x':${inputContext.x.fieldValue},'y':${inputContext.y.fieldValue}}`
            }],
            "data":inputContext.data || circleBaseContext.data,
            "mark":{
                "type":"circle",
                "size": {
                    "expr": inputContext.size || circleBaseContext.size
                },
                "x": {
                    "expr": `clamp(${inputContext.x.fieldValue}, ${inputContext.x.scale}range.min, ${inputContext.x.scale}range.max)`
                },
                "y": {
                    // remember that y needs to be inverted (lower is higher)
                    "expr": `clamp(${inputContext.y.fieldValue}, ${inputContext.y.scale}range.min, ${inputContext.y.scale}range.max)`
                },
                "color": {
                    "expr": inputContext.color || circleBaseContext.color
                },
                stroke: {
                    "expr": inputContext.stroke || circleBaseContext.stroke
                }
            }
        }
    }
}