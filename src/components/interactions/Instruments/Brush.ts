import { IntervalSelect } from "../interval-select";
import { DragSpan } from "../drag2";
import { Rect } from "../../marks/rect";
import { BindingManager } from "../../../binding/BindingManager";

export class Brush {
    constructor() {

        


        // const intervalSelect = new IntervalSelect();
        const drag = new DragSpan();
        

        // // Set up internal bindings
        // bindingManager.addBinding(
        //     rect.id,
        //     drag2.id,
        //     'x', 'x1'
        // );



        return drag;
    }
}


// steps :

// 1. change all anchors to be encoding anchors (such that we group on encoding type)