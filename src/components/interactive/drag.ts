import { BaseComponent } from "../base";
import { MouceEventAnchors, MouseEventAnchors } from "../../anchors/mouseEvents";
import { CompilationContext, CompilationResult, ParentInfo } from "../../types/compilation";
import { Line, Area, Point } from "types/geometry";
import { EventAnchorSchema, EventAnchorsSchema } from "types/anchors";
import {EventStream, Signal} from "vega-typings";

type DragConfig = {
  x?: number;
  y?: number;
};

type MouseMoveConfig = {
    x?: number;
    y?: number;
    between?: [EventStream, EventStream];
    source?: "view" | "scope" | "window";
    filter?: string[];
}

export class MouseMove extends BaseComponent {
    private config: MouseMoveConfig;

    constructor(config: MouseMoveConfig = {}) {
        super();
        this.config = config;
        this.initializeAnchors();
    }

    private initializeAnchors() {
        const mousemove = new MouseEventAnchors(this);
        const instantiatedMouseAnchors = mousemove.initializeMouseAnchors();
        instantiatedMouseAnchors.forEach((anchor) => {
            const proxy = this.createAnchorProxy(anchor)
            // note this is using the anchor schema id
            this.anchors.set(anchor.id, proxy);
        });
    }

    compileComponent(context: CompilationContext, parentInfo?: ParentInfo): CompilationResult {

        // chart>point>drag
        // chart>drag>point  // anywhere you drag on the chart, the mark goes where you drag
        // point>drag
        let markname = undefined;
        if(parentInfo?.parentAnchor.type === "geometric") {
            markname = parentInfo.parentComponent.id +"_marks";
        }


        // but this information would need to be added at the vega level (ie mark names are known there)
        // INFO I need: what is the parent anchor? Is it a mark, and if so, what is its name?
        
        // if parent is a mark, then use markname
        

        const signal : Signal = {
            name: this.id,
            value: { x: this.config.x, y: this.config.y , movementX: 0, movementY: 0},
            on: [{
                events: {
                    source: this.config.source,
                    markname: markname,
                    type: 'pointermove',
                    between: this.config.between,
                    filter: this.config.filter,
                },
                update: "event"
            }]
        }
        return {"componentId": this.id, "spec": {"params": [signal]}, "binding": context.bindings[0]};
      }
}


export class Drag extends MouseMove {
    constructor(config: DragConfig = {}) {
        super({
            ...config,
            between: [
                { type: "pointerdown" },
                { type: "pointerup" }
            ]
        });
    }
}

