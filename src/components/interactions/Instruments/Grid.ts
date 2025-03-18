import { DragSpan } from "../drag2";
import { BindingManager } from "../../../binding/BindingManager";

export class Grid {
    constructor(config:any) {

        const lines = new VGXSet(new Line(config));
        const drag = new DragSpan(config);
        

        return drag;
    }
}


const configurations = [{
    'id': 'position',
    "default": true,
    "schema": {
        "x": {
            "container": "Set",
            "valueType": "Numeric",
            // "interactive": true
        },
        "y": {
            "container": "Set",
            "valueType": "Numeric",
            // "interactive": true
        }
    },
    "transforms": [
        { "name": "x", "channel": "x", "value": "PARENT_ID.x" }, //data set x value will be each x value.
        { "name": "y", "channel": "y", "value": "PARENT_ID.y" } //data set y value will be each y value.
    ]
}];
