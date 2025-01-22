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

    constructor(config:CircleConfig={}){
        super()
        this.anchors = generateAnchorsFromContext(circleBaseContext,this);
        this.config = config;
        console.log('circle',this.anchors)
        this.initializeAnchors()
      
          // Setup channel bindings
          // Programmatically create all anchor properties
          this.anchors.forEach(anchor => {
            Object.defineProperty(this, anchor.id.anchorId, {
              value: config[anchor.id.anchorId] ?? null,
              writable: true,
              enumerable: true,
              configurable: true
            });
          });
    }

    compileComponent(inputContext:compilationContext): Partial<UnitSpec<Field>> {
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