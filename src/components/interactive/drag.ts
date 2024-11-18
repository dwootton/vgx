import { BaseComponent } from "../base";
import { MouceEventAnchors, MouseEventAnchors } from "../../anchors/mouseEvents";
import { CompilationContext, CompilationResult, ParentInfo } from "../../types/compilation";
import { Line, Area, Point } from "types/geometry";
import { AnchorProxy, EventAnchorSchema, EventAnchorsSchema } from "types/anchors";
import {EventStream, Signal} from "vega-typings";

type DragConfig = {
  x?: number;
  y?: number;
};



export class MouseMoveEvent extends BaseComponent {
    constructor(source: string, between: [AnchorProxy, AnchorProxy], filter?: string) {
        super();
        this.source = source;

        

        this.between = between;
        this.filter = filter;
    }

    compileComponent(context: CompilationContext, parentInfo?: ParentInfo): CompilationResult {

        return {source: this.source, between: this.between, filter: this.filter}
    }
}

export class MouseMove extends BaseComponent {    
    constructor() {
        super();
        this.initializeAnchors();
        
    }

    private initializeAnchors() {
        const mousemove = new MouseEventAnchors(this);
        const instantiatedMouseAnchors = mousemove.initializeMouseAnchors();
        const instantiatedEventAnchors = mousemove.initializeEventAnchors();

        // set the anchors
        [...instantiatedMouseAnchors, ...instantiatedEventAnchors].forEach((anchor) => {
            const proxy = this.createAnchorProxy(anchor)
            // note this is using the anchor schema id
            this.anchors.set(anchor.id, proxy);
        });

    }

    compileComponent(context: CompilationContext, parentInfo?: ParentInfo): CompilationResult {
        return { "componentId": this.id, "spec": { "params": [] }, "binding": context.bindings[0] , queries: []};
    }
}



export class Drag extends BaseComponent {
    constructor(config: DragConfig = {}) {
        super();
        this.initializeAnchors();
    }

    private initializeAnchors() {
        const mousemove = new MouseMove();
        const mouseup = new MouseUp();
        const mousedown = new MouseDown();

        const instantiatedMouseAnchors = mousemove.initializeMouseAnchors();
    }

    compileComponent(context: CompilationContext, parentInfo?: ParentInfo): CompilationResult {
        return { "componentId": this.id, "spec": { "params": [] }, "binding": context.bindings[0] , queries: []};
    }
}







/*
export class MouseMove extends BaseComponent {
    private config: MouseMoveConfig;

    constructor() {
        super();
        const config = {event: "mousemove"};
        this.config = config;
        this.initializeAnchors();
    }

    private initializeAnchors() {
        const mousemove = new MouseEventAnchors(this);
        const instantiatedMouseAnchors = mousemove.initializeMouseAnchors(this.config);
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

        //@ts-ignore as we're using signals in VL params
        return { "componentId": this.id, "spec": { "params": [signal] }, "binding": context.bindings[0] };
    }
}
*/