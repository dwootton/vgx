import { BaseComponent } from "../base";
import { Field } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import { compilationContext } from '../../binding/binding';
import { AnchorType } from "types/anchors";
import { generateAnchorsFromContext } from "../../utils/anchorProxy";
import { generateComponentSignalName } from "../../utils/component";
import { generateParams } from "../../utils/compilation";

export const dragBaseContext: Record<AnchorType, any> = {
    targetElementId: null,
    start: { x: 0, y: 0 },
    stop: { x: 0, y: 0 },
    x: 0,
    y: 0
}

type DragConfig = {
    [K in keyof typeof dragBaseContext]?: typeof dragBaseContext[K]
}

export class Drag extends BaseComponent {
    public config: DragConfig;

    constructor(config: DragConfig = {}) {
        super(config);
        this.anchors = generateAnchorsFromContext(config,dragBaseContext, this,{'x':{interactive:true},'y':{interactive:true}});
        this.config = config;
        console.log('drag', this.anchors);
        this.initializeAnchors();
    }

    compileComponent(inputContext: compilationContext): Partial<UnitSpec<Field>> {
        // if inputContext,
        const signal = {
            name: this.id,
            value: dragBaseContext,
            on: [{
                events: {
                    type: 'pointermove',
                    between: [
                        { type: "pointerdown", "markname": inputContext.targetElementId},
                        { type: "pointerup" }
                    ]
                },
                update: "{x:x(),y:y()}"
            },
            {
                "events": {
                    "type": "pointerdown",
                },
                "update": `merge(${this.id},{start:{x:x(),y:y()}})`
            },
            {
                "events": {
                    "type": "pointerup",
                },
                "update": `merge(${this.id},{stop:{x:x(),y:y()}})`
            }]
        };

       // if 

        return {
            params: [{
                name: generateComponentSignalName(this.id),
                //@ts-ignore, this is acceptable because params can take expr strings
                expr: generateParams(inputContext)
                //@ts-ignore, this is acceptable because params can take expr strings
            }, signal]
        };
    }
}
