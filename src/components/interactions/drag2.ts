import { BaseComponent } from "../base";
import { Field } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import { compilationContext } from '../../binding/binding';
import { AnchorIdentifer, AnchorSchema } from "types/anchors";
import { generateAnchorsFromContext } from "../../utils/anchorProxy";
import { generateComponentSignalName } from "../../utils/component";
import { generateParams } from "../../utils/compilation";

export const dragBaseContext = {

}

// maybe schemas actually work as data extractors on some base context
// e.g. drag always compiles to things such as x,y,start,stop, but this schemas have an additional update states
// that will take in that and then return the encoding values.

const currentExtractor = (channel: string) => ({
    type: 'Scalar',
    channel: channel,
    update: `VGX_SIGNAL_NAME.${channel}`
});

const rangeExtractor = (channel: string) => ({
    type: 'Range',
    channel: channel,   
    update: `{
        start: VGX_SIGNAL_NAME.start.${channel},
        stop: VGX_SIGNAL_NAME.stop.${channel}
    }`
});

const startExtractor = (channel: string) => ({
    type: 'Scalar',
    channel: channel,
    update: `VGX_SIGNAL_NAME.start.${channel}`
});

// x has encoding schema, y has encoding schema 
// top -> x1+y1, y1 => implies this must be a point, so for now lets limit it to only one interactor schema per bind
// 



// inputs: 
// element: string

// schema 
    // span: 
        // schema: range
        // // events: 
        
        // {
        //         events: {
        //             type: 'pointermove',
        //             between: [
        //                 { type: "pointerdown", "markname": inputContext.markName},
        //                 { type: "pointerup" }
        //             ]
        //         },
        //         update: `merge(${nodeId}, {'x': x(), 'y': y() })`
        //     },

// any encoding types will compile down to 

// brush.top, this is a anchor for dragspan(y,x) and 
// when a new anchorname is bound, check top level anchor properties
    // then if not, check the generated anchors from each schema. 

// anchornames are generated via taking in both schema types (x,y)
// 


import {EncodingValues} from "types/anchors";

type InteractorSchema = {
    schemaId: string; // 'current', 'span'
    schemaType: EncodingValues
    extractors: any[]
}

export class DragStart extends BaseComponent {
    public schemas: InteractorSchema[];
    constructor(config: any = {}) {
        super(config);

        this.schemas = [{
            schemaId: 'start',
            schemaType: 'Scalar',
            extractors: [startExtractor('x'), startExtractor('y')]
        }];

        this.initializeAnchors();
    }

    compileComponent(inputContext: compilationContext): Partial<UnitSpec<Field>> {
        const nodeId = inputContext.nodeId || this.id;
        const signal = {
            name: this.id,
            value: dragBaseContext,
            on: [{
                "events": {
                    "type": "pointerdown",
                    "markname": inputContext.markName
                },
                "update": `merge(${nodeId}, {'x':x(),'y':y()})`
            }]
        };

        return {
            params: [signal]
        };
    }
}

export class DragSpan extends BaseComponent {
    public schemas: InteractorSchema[];
    constructor(config: any = {}) {
        super(config);

        this.schemas = [{
            schemaId: 'span',
            schemaType: 'Range',
            extractors: [rangeExtractor('x'), rangeExtractor('y')]
        }];

        this.initializeAnchors();
    }

    compileComponent(inputContext: compilationContext): Partial<UnitSpec<Field>> {
        const nodeId = inputContext.nodeId || this.id;
        const signal = {
            name: this.id,
            value: dragBaseContext,
            on: [{
                events: {
                    type: 'pointermove',
                    between: [
                        { type: "pointerdown", "markname": inputContext.markName},
                        { type: "pointerup" }
                    ]
                },
                update: `merge(${nodeId}, {'start': {'x': x(), 'y': y()}, 'stop': {'x': x(), 'y': y()}})`
            }]
        };

        return {
            params: [signal]
        };
    }
}

export class Drag extends BaseComponent {
    public schemas: InteractorSchema[];
    constructor(config: any = {}) {
        super(config);

        this.schemas = [{
            schemaId: 'current',
            schemaType: 'Scalar', 
            extractors: [currentExtractor('x'), currentExtractor('y')]
        }];

        this.initializeAnchors();
    }

    compileComponent(inputContext: compilationContext): Partial<UnitSpec<Field>> {
        const nodeId = inputContext.nodeId || this.id;
        const signal = {
            name: this.id,
            value: dragBaseContext,
            on: [{
                events: {
                    type: 'pointermove',
                    between: [
                        { type: "pointerdown", "markname": inputContext.markName},
                        { type: "pointerup" }
                    ]
                },
                update: `merge(${nodeId}, {'x': x(), 'y': y()})`
            }]
        };

        return {
            params: [signal]
        };
    }
}
