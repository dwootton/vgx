import { BaseComponent } from "../base";
import { Field } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import { compilationContext } from '../../binding/binding';
import { AnchorIdentifer } from "types/anchors";
import { generateAnchorsFromContext } from "../../utils/anchorProxy";
import { generateComponentSignalName } from "../../utils/component";
import { generateParams } from "../../utils/compilation";

export const dragBaseContext: Record<AnchorIdentifer, any> = {
    targetElementId: null,
    start:{
        x:0,
        y:0
    },
  
    // start: { x: 0, y: 0 },
    // stop: { x: 0, y: 0 },
    x: 0,
    y: 0,
    markName: null
}


type DragConfig = {
    [K in keyof typeof dragBaseContext]?: typeof dragBaseContext[K]
}

export class Drag extends BaseComponent {
    public config: DragConfig;

    constructor(config: DragConfig = {}) {
        super(config);
        this.anchors = generateAnchorsFromContext(dragBaseContext, this,{'x':{interactive:true},'y':{interactive:true}, start:{'x':{interactive:true},'y':{interactive:true}}});
        this.config = config;
        this.initializeAnchors();
    }

    compileComponent(inputContext: compilationContext): Partial<UnitSpec<Field>> {
        const nodeId = inputContext.nodeId || this.id;
        // if inputContext,
        const signal = {
            name: nodeId,
            value: dragBaseContext,
            on: [{
                events: {
                    type: 'pointermove',
                    between: [
                        { type: "pointerdown", "markname": inputContext.markName},
                        { type: "pointerup" }
                    ]
                },
                update: `merge(${nodeId}, {'x': x(), 'y': y() })`
            },
            {
                "events": {
                    "type": "pointerdown",
                },
                "update": `merge(${nodeId}, {'start_x':x(),'start_y':y(), 'x': x(), 'y': y()  })`
            },
            {
                "events": {
                    "type": "pointerup",
                },
                "update": `merge(${nodeId}, {'stop_x':x(),'stop_y':y()})`
            }]
        };

       // if 

        return {
            //@ts-ignore, this is acceptable because params can take expr strings
            params: [signal]
            //     {
            //     name: generateComponentSignalName(nodeId),
            //     //@ts-ignore, this is acceptable because params can take expr strings
            //     expr: `{x:${inputContext.x.fieldValue},y:${inputContext.y.fieldValue}}`//generateParams(inputContext)
            //     //@ts-ignore, this is acceptable because params can take expr strings
            // },]
             
        };
    }
}
