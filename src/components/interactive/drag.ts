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
        let markname = undefined;
        if (parentInfo?.parentAnchor.type === "geometric") {
            markname = parentInfo.parentComponent.id + "_marks";
        }

        let events: any = {
            source: this.config.source,
            type: 'pointermove',
            filter: this.config.filter,
        };

        // if a markname is provided
        if (this.config.between) {
            events.between = [
                { ...this.config.between[0], markname },
                this.config.between[1]
            ];
        } else {
            events.markname = markname;
        }

        const signal: Signal = {
            name: this.id,
            value: { x: this.config.x, y: this.config.y, movementX: 0, movementY: 0 },
            on: [{
                events: events,
                update: "{x:x(),y:y()}"
            }]
        };

        return { "componentId": this.id, "spec": { "params": [signal] }, "binding": context.bindings[0] };
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

