import { DragSpan } from "../drag2";
import { BindingManager } from "../../../binding/BindingManager";

export class Brush {
    constructor(config:any) {

        const drag = new DragSpan(config);
        



        return drag;
    }
}


// steps :

// 1. change all anchors to be encoding anchors (such that we group on encoding type)