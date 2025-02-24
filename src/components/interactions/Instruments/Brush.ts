import { IntervalSelect } from "../interval-select";
import { Drag } from "../drag";
import { Rect } from "../../marks/rect";
import { BindingManager } from "../../../binding/BindingManager";

export class Brush {
    constructor() {

        


        const rect = new Rect({y1:0, y2:100});
        // const intervalSelect = new IntervalSelect();
        const drag = new Drag();
        // const drag2 = new Drag();
        const bindingManager = BindingManager.getInstance();
        
        // Set up internal bindings
        bindingManager.addBinding(
            drag.id,
            rect.id,
            'start_x', 'x1'
        );

        bindingManager.addBinding(
            drag.id,
            rect.id,
            'x', 'x2'
        );

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