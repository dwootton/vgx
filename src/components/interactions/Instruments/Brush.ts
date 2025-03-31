import { DragSpan, dragBaseContext, generateConfigurationAnchors } from "../Drag";
import { Rect } from "../../marks/rect";
import { BaseComponent } from "../../base";
import { extractAllNodeNames, generateSignal, generateSignalsFromTransforms } from "../../utils";
import { calculateValueFor } from "../../resolveValue";
import { UnitSpec } from "vega-lite/build/src/spec";
import { Field } from "vega-lite/build/src/channeldef";
import { DataAccessor } from "../../DataAccessor";
import { BindingManager } from "../../../binding/BindingManager";
import { extractComponentBindings } from "../../../binding/utils";
import { constructValueFromContext } from "../../../utils/contextHelpers";
import { Constraint } from "../../../binding/constraints";
const brushBaseContext = {
    "start": {
        "x": 0,
        "y": 0
    },
    "stop": {
        "x": 1000,
        "y": 1000
    },

    "color": "'firebrick'",
    "stroke": "'white'"
}

export class BrushConstructor {
    id: string;
    constructor(config: any) {


        // Get all components that need to be bound
        const allBindings = extractComponentBindings(config);




        const drag = new DragSpan({ bind: [{ span: [new Rect({ "strokeDash": [6, 4], 'stroke': 'firebrick', 'strokeWidth': 2, 'strokeOpacity': 0.7, 'fillOpacity': 0.2, 'fill': 'firebrick' })] },] });


        const brush = new Brush({ bind: [...allBindings, drag] });


        this.id = brush.id;

        // const dragProxy = new Proxy(drag, {
        //     get(target, prop, receiver) {
        //         // If accessing 'data' property, redirect to brush.data
        //         if (prop === 'data') {
        //             return brush._data;
        //         }
        //         if (prop === 'brush') {
        //             return brush;
        //         }

        //         // For all other properties, use the original drag object
        //         return Reflect.get(target, prop, receiver);
        //     }
        // });

        // const bindingManager = BindingManager.getInstance();

        // bindingManager.removeComponent(drag.id);
        // bindingManager.addComponent(dragProxy);

        // brush.drag = dragProxy;

        console.log('brush constructor', brush)
        // Return the proxy instead of the original drag object
        return brush;

    }
}

type CompilationContext = Record<string, Constraint[]>;

const configurations = [{
    'id': 'interval',
    "default": true,
    "schema": {
        "x": {
            "container": "Range",
            "valueType": "Numeric",
            // "interactive": true
        },
        "y": {
            "container": "Range",
            "valueType": "Numeric",
            // "interactive": true // TODO add back in when it won't screw with the chart domains
        },
    },
    "transforms": [
        { "name": "start_x", "channel": "x", "value": "BASE_NODE_ID.start.x" },
        { "name": "stop_x", "channel": "x", "value": "BASE_NODE_ID.stop.x" },
        { "name": "start_y", "channel": "y", "value": "BASE_NODE_ID.start.y" },
        { "name": "stop_y", "channel": "y", "value": "BASE_NODE_ID.stop.y" },

    ]
},
{
    'id': 'top',
    "schema": {
        "x": {
            "container": "Range",
            "valueType": "Numeric",
            // "interactive": true
        },
        "y": {
            "container": "Scalar",
            "valueType": "Numeric",
            // "interactive": true // TODO add back in when it won't screw with the chart domains
        },
    },
    "transforms": [
        //     {
        //     "name": "x",
        //     "channel": "x",
        //     "value": "(BASE_NODE_ID_interval_start_x+BASE_NODE_ID_interval_stop_x)/2" // replace the parent id + get the channel value
        // },
        { "name": "start_x", "channel": "x", "value": "BASE_NODE_ID.start.x" },
        { "name": "stop_x", "channel": "x", "value": "BASE_NODE_ID.stop.x" },
        {
            "name": "y",
            "channel": "y",
            "value": "BASE_NODE_ID_interval_start_y" // replace the parent id + get the channel value
        },
        // {
        //     "name": "y",
        //     "channel": "y",
        //     "value": "BASE_NODE_ID_interval_stop_y" // replace the parent id + get the channel value
        // }
    ]
}]


export class Brush extends BaseComponent {
    _data: DataAccessor;
    accessors: DataAccessor[];
    constructor(config: any = {},) {
        super(config, configurations);
        this._data = new DataAccessor(this);
        console.log('brush constructor', this._data)

        this.accessors = [];
        configurations.forEach(config => {
            const schema = config.schema
            for (const key in schema) {
                const schemaValue = schema[key];
                const keyName = config.id + '_' + key
                this.schema[keyName] = schemaValue;


                this.anchors.set(keyName, this.createAnchorProxy({ [keyName]: schemaValue }, keyName, () => {
                    const generatedAnchor = generateConfigurationAnchors(this.id, config.id, key, schemaValue)
                    return generatedAnchor
                }));
            }
        });

        console.log('Brush anchors', this.anchors)

        this._data.filter(`vlSelectionTest(${this.id}_store, datum)`)// any data referenced from the brush will be filtered
    }

    get data(): DataAccessor {
        console.log('getting data accessor', this.id)
        const accessor = new DataAccessor(this);
        this.accessors.push(accessor);
        return accessor.filter(`vlSelectionTest(${this.id}_store, datum)`)
    }

    compileComponent(inputContext: CompilationContext): Partial<UnitSpec<Field>> {
        const selection = {
            "name": this.id + "_selection",
            "select": {
                "type": "interval",
                "mark": {
                    "fill": null,
                    "stroke": null,

                }
            }
        }

        const brushBaseSignal = {
            "name": this.id,
            "value": brushBaseContext
        }

        const allSignals = inputContext.VGX_SIGNALS

        const { x, y } = inputContext.VGX_CONTEXT

        const selectionModifications = [{ "name": "VGXMOD_" + this.id + "_x", "on": [{ "events": [{ "signal": x.start.expr }, { "signal": x.stop.expr }], "update": `[${x.start.expr},${x.stop.expr}]` }] },
        { "name": "VGXMOD_" + this.id + "_y", "on": [{ "events": [{ "signal": y.start.expr }, { "signal": y.stop.expr }], "update": `[${y.start.expr},${y.stop.expr}]` }] }]


        return {
            params: [selection, ...allSignals, brushBaseSignal, ...selectionModifications]
        }
    }
}
