import { BaseComponent } from "../base";
import { Field, isContinuousFieldOrDatumDef } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import {compilationContext} from '../../binding/binding';
import { AnchorProxy, AnchorType } from "types/anchors";
import { generateAnchorsFromContext } from "../../utils/anchorProxy";
import { generateComponentSignalName } from "../../utils/component";
import { generateParams } from "../../utils/compilation";

export const circleBaseContext: Record<AnchorType, any> = {
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
        this.anchors = generateAnchorsFromContext(config,circleBaseContext,this);

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
        console.log('inputContext', inputContext)
        return {
            // add param which will always be the value for this component
            "params":[{
                "name":generateComponentSignalName(this.id),
                //@ts-ignore, this is acceptable because params can take expr strings
                "expr":generateParams(inputContext)
                
            }],
            "data":inputContext.data || circleBaseContext.data,
            "mark":{
                "type":"circle",
                "size":{
                    "expr":inputContext.size || circleBaseContext.size
                },
                "x":{
                    "expr":inputContext.x || circleBaseContext.x
                },
                "y":{
                    "expr":inputContext.y || circleBaseContext.y
                },
                "color":{
                    "expr":inputContext.color || circleBaseContext.color
                },
                "stroke":{
                    "expr":inputContext.stroke || circleBaseContext.stroke
                }
            }
        }
    }
}