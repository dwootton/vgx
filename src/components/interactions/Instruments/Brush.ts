import { IntervalSelect } from "../interval-select";
import { Drag } from "../drag";
import { Rect } from "../../marks/rect";
import { BindingManager } from "../../../binding/BindingManager";

export class Brush {
    constructor() {
        const rect = new Rect({y1:0, y2:100});
        //const intervalSelect = new IntervalSelect();
        const drag = new Drag();
        
        // Set up internal bindings
        BindingManager.getInstance().addBinding(
            drag.id,
            rect.id,
            'x1', 'x1'
        );

        BindingManager.getInstance().addBinding(
            drag.id,
            rect.id,
            'x', 'x2'
        );


        // const drag2 = new Drag();
        // // then lets add a drag binding to the rect
        // BindingManager.getInstance().addBinding(
        //     rect.id,
        //     drag2.id,
        //     'markname', 'markname'
        // );

        // commenting out for now as y
        // BindingManager.getInstance().addBinding(
        //     intervalSelect.id,
        //     rect.id,
        //     'y', 'y'
        // );

        //const intervalDrag = new Drag(); TODO: add drag to brush body

        return drag;
    }
}
