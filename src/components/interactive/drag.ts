import { BaseComponent } from "../base";
import { MouceEventAnchors, MouceEventAnchorConfig, MouseEventAnchors } from "../../anchors/mouseEvents";
import { CompilationContext, CompilationResult, ParentInfo } from "../../types/compilation";
import { Line, Area, Point } from "types/geometry";
import { AnchorProxy, EventAnchorSchema, EventAnchorsSchema } from "types/anchors";
import { EventStream, Signal } from "vega-typings";



export class Drag extends BaseComponent {
    private mouseEventAnchors: MouseEventAnchors;
    constructor(config: MouceEventAnchorConfig = {}) {
        super();
        this.mouseEventAnchors = new MouseEventAnchors();
        this.initializeAnchors();
    }

    private initializeAnchors() {

        // Initialize base rect anchors
        const anchors = this.mouseEventAnchors.initializeMouseAnchors({});

        // Add to component anchors
        anchors.forEach((anchor, id) => {
            this.anchors.set(id, this.createAnchorProxy(anchor));
        });
    }



    compileComponent(context: CompilationContext): CompilationResult {

        const signal = {
            name: this.id,
            value: { x: 0, y: 0 },
            on: [{
                events: {
                    type: 'pointermove',
                    between: [
                        { type: "pointerdown", "markname": context.binding.parentAnchorId.componentId + "_marks" },
                        { type: "pointerup" }
                    ]
                }
            }
            ]
        };



        return { params: [signal] };
    }
}








// export class MouseMove extends BaseComponent {
//     private config: MouceEventAnchorConfig;

//     constructor() {
//         super();
//         const config = {event: "mousemove"};
//         this.config = config;
//         this.initializeAnchors();
//     }

//     private initializeAnchors() {
//         const mousemove = new MouseEventAnchors(this);
//         const instantiatedMouseAnchors = mousemove.initializeMouseAnchors(this.config);
//         instantiatedMouseAnchors.forEach((anchor) => {
//             const proxy = this.createAnchorProxy(anchor)
//             // note this is using the anchor schema id
//             this.anchors.set(anchor.id, proxy);
//         });
//     }

//     compileComponent(context: CompilationContext, parentInfo?: ParentInfo): CompilationResult {
//         let markname = undefined;
//         if (parentInfo?.parentAnchor.type === "geometric") {
//             markname = parentInfo.parentComponent.id + "_marks";
//         }

//         let events: any = {
//             source: this.config.source,
//             type: 'pointermove',
//             filter: this.config.filter,
//         };

//         // if a markname is provided
//         if (this.config.between) {
//             events.between = [
//                 { ...this.config.between[0], markname },
//                 this.config.between[1]
//             ];
//         } else {
//             events.markname = markname;
//         }

//         const signal: Signal = {
//             name: this.id,
//             value: { x: this.config.x, y: this.config.y, movementX: 0, movementY: 0 },
//             on: [{
//                 events: events,
//                 update: "{x:x(),y:y()}"
//             }]
//         };

//         //@ts-ignore as we're using signals in VL params
//         return { "componentId": this.id, "spec": { "params": [signal] }, "binding": context.bindings[0] };
//     }
// }
