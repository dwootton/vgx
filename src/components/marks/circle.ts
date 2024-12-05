import { BaseComponent } from "components/base";
import { Field, isContinuousFieldOrDatumDef } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import {compilationContext} from '../../binding/binding';
import { AnchorProxy, AnchorType } from "types/anchors";

export const circleBaseContext: Record<AnchorType, any> = {
    x: null,
    y: null,
    size: 50,
    color: "red",
    stroke: "white", 
    data: [{}] // Empty data array to only render one mark
}

type CircleConfig = {
    [K in keyof typeof circleBaseContext]?: typeof circleBaseContext[K]
}

export class Circle extends BaseComponent {
    public config: CircleConfig;

    constructor(config:CircleConfig={}){
        super()
        this.anchors = this.generateAnchorsFromContext(circleBaseContext);
        this.config = config;
        this.initializeAnchors()
    }


    compileComponent(inputContext:compilationContext): Partial<UnitSpec<Field>> {

        return {
            "data":inputContext.data,
            "mark":{
                "type":"circle",
                "x":{
                    "expr":inputContext.x
                },
                "y":{
                    "expr":inputContext.y
                },
                "color":{
                    "expr":inputContext.color
                },
                "stroke":{
                    "expr":inputContext.stroke
                }
            }
        }
        
    }






}