import { CombinedDrag, } from "../Drag";
import { BindingManager } from "../../../binding/BindingManager";
import { Line } from "../../marks/line";

export class Grid {
    constructor(config:any) {

        const lines = new DraggableLine({'x':40});
        
        const lines2 = new DraggableLine(config);


        return [lines,lines2];
    }
}


export class DraggableLine extends Line {
    constructor(config:any) {
        super(config);
        

        const lines = new Line({...config,bind: {x: new CombinedDrag(config)}});
        

        return lines;
        
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
