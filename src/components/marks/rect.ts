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

type RectConfig = {
    [K in keyof typeof rectBaseContext]?: typeof rectBaseContext[K]
}

import { generateRectAnchors } from "../../utils/anchorGeneration/rectAnchors";
export class Rect extends BaseComponent {
    public config: RectConfig;
    static bindableProperties = ['x1', 'x2', 'y1', 'y2', 'size', 'color', 'stroke'] as const;

    constructor(config:RectConfig={}){
        super({...config})
        this.anchors = generateAnchorsFromContext(rectBaseContext,this);

        Rect.bindableProperties.forEach(prop => {
            if (config[prop] !== undefined) {
                this.addContextBinding(prop, config[prop]);
            }
        });

        const rectAnchors = generateRectAnchors(this);

        
        this.anchors = new Map([...this.anchors, ...rectAnchors]);
        
        // Create group anchors
        this.createGroupAnchor('x', ['x1', 'x2']);
        this.createGroupAnchor('y', ['y1', 'y2']);
        
        Object.entries(rectBaseContext).forEach(([key, value]) => {
            if (config[key as keyof RectConfig] === undefined) {
                this.addContextBinding(key, value, 'baseContext');
            }
        });

        this.addContextBinding('markName', this.id+"_marks", 'baseContext');


        this.config = config;
        this.initializeAnchors()
         
    }

    

    compileComponent(inputContext:compilationContext): Partial<UnitSpec<Field>> {
        return {
            params: [
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
                    expr: `clamp(${inputContext.x1.fieldValue}, ${inputContext.x1.scale}range.min, ${inputContext.x1.scale}range.max)`
                },
                x2: {
                    expr: `clamp(${inputContext.x2.fieldValue}, ${inputContext.x2.scale}range.min, ${inputContext.x2.scale}range.max)`
                },
                // y: {
                //     expr: `clamp(${inputContext.y1.fieldValue}, ${inputContext.y1.scale}range.min, ${inputContext.y1.scale}range.max)`
                // },
                // y2: {
                //     expr: `clamp(${inputContext.y2.fieldValue}, ${inputContext.y2.scale}range.min, ${inputContext.y2.scale}range.max)`
                // },
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