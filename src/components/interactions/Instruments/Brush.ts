import { IntervalSelect } from "../interval-select";
import { Rect } from "../../marks/rect";
import { BindingManager } from "../../../binding/BindingManager";

export class Brush {
    constructor() {
        const rect = new Rect({y1:0, y2:100});
        const intervalSelect = new IntervalSelect();
        
        // Set up internal bindings
        BindingManager.getInstance().addBinding(
            intervalSelect.id,
            rect.id,
            'x', 'x'
        );

        // commenting out for now as y
        // BindingManager.getInstance().addBinding(
        //     intervalSelect.id,
        //     rect.id,
        //     'y', 'y'
        // );

        //const intervalDrag = new Drag(); TODO: add drag to brush body

        return intervalSelect;
    }
}
