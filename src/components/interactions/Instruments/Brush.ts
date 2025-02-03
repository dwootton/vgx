import { IntervalSelect } from "../interval-select";
import { Rect } from "../../marks/rect";
import { BindingManager } from "../../../binding/BindingManager";

export class Brush {
    constructor() {
        const rect= new Rect();
        const intervalSelect = new IntervalSelect();
        
        // Set up internal bindings
        BindingManager.getInstance().addBinding(
            intervalSelect.id,
            rect.id,
            'x', 'x'
        );

        BindingManager.getInstance().addBinding(
            intervalSelect.id,
            rect.id,
            'y', 'y'
        );

        return intervalSelect;
    }
}
