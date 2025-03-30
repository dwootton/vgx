import { BaseComponent } from "../base";
import { Field, isContinuousFieldOrDatumDef } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import { compilationContext } from '../../binding/binding';
import { AnchorProxy, AnchorIdentifer, SchemaType } from "../../types/anchors";

import { generateSignalFromAnchor, createRangeAccessor, generateCompiledValue, generateSignalsFromTransforms, generateSignal } from "../utils";
import { extractSignalNames } from "../../binding/mergedComponent";

const lineBaseContext = {
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
// Define the configurations with schemas and transforms
const configurations = [{
    'id': 'position',
    "default": true,
    "schema": {
        "data": {
            "container": "Data",
            "valueType": "Data",
            // "interactive": true
        },
        "x": {
            "container": "Range",
            "valueType": "Numeric",
            // "interactive": true
        },
        "y": {
            "container": "Range",
            "valueType": "Numeric",
            // "interactive": true
        },
        "markName": {
            "container": "Absolute",
            "valueType": "Categorical",
            // "interactive": true
        }
    },
    "transforms": [
        { "name": "start_x", "channel": "x", "value": "BASE_NODE_ID.start.x" }, // treat x like a scalar
        { "name": "stop_x", "channel": "x", "value": "BASE_NODE_ID.stop.x" }, // treat x like a scalar
        { "name": "start_y", "channel": "y", "value": "BASE_NODE_ID.start.y" },
        { "name": "stop_y", "channel": "y", "value": "BASE_NODE_ID.stop.y" }, //data set y value will be each y value.
    ]
},
{
    'id': 'x',
    "schema": {
        "x": {
            "container": "Scalar",
            "valueType": "Numeric",
            // "interactive": true
        },
        // "markName": {
        //     "container": "Scalar",
        //     "valueType": "Absolute",
        //     // "interactive": true
        // }

        // "markName": {
        //     "container": "Scalar",
        //     "valueType": "Categorical",
        //     // "interactive": true
        // }
    },
    "transforms": [
        { "name": "x", "channel": "x", "value": "BASE_NODE_ID.x.start" },
        { "name": "start_x", "channel": "x", "value": "BASE_NODE_ID.start.x" }, // treat x like a scalar
        { "name": "stop_x", "channel": "x", "value": "BASE_NODE_ID.stop.x" }, // treat x like a scalar
        { "name": "start_y", "channel": "y", "value": "BASE_NODE_ID.start.y" },
        { "name": "stop_y", "channel": "y", "value": "BASE_NODE_ID.stop.y" }, //data set y value will be each y value.
    ]
}, {
    'id': 'y',
    "schema": {
        "x": {
            "container": "Range",
            "valueType": "Numeric",
            // "interactive": true
        },
        "y": {
            "container": "Range",
            "valueType": "Numeric",
            // "interactive": true
        }
    },
    "transforms": [
        { "name": "start_x", "channel": "x", "value": "BASE_NODE_ID.start.x" },
        { "name": "stop_x", "channel": "x", "value": "BASE_NODE_ID.stop.x" },
        { "name": "start_y", "channel": "y", "value": "BASE_NODE_ID.start.y" },
        { "name": "stop_y", "channel": "y", "value": "BASE_NODE_ID.stop.y" },
    ]
}
];



import { generateConfigurationAnchors } from "../interactions/Drag";
import { calculateValueFor } from "components/resolveValue";


export class Line extends BaseComponent {
    public schema: Record<string, SchemaType>;
    public configurations: Record<string, any>;

    constructor(config: any = {}) {
        super({ ...config }, configurations)



        // Set up the main schema from configurations
        this.schema = {};


        configurations.forEach(config => {
            // this.configurations[config.id] = config
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



    }

    compileComponent(inputContext: compilationContext): Partial<UnitSpec<Field>> {
        const { x, y, data } = inputContext.VGX_CONTEXT
        const allSignals = inputContext.VGX_SIGNALS

        return {
            params: [
                {
                    "name": this.id,
                    "value": lineBaseContext,
                },
                ...allSignals,
            ],
            "data": data,
            name: `${this.id}_position_markName`,
            mark: {
                type: "rule",

            },
            "encoding": {
                "x": {
                    "value": x.start,
                },
                "y": {
                    "value": y.start,
                },
                "x2": {
                    "value": x.stop,
                },
                "y2": {
                    "value": y.stop,
                },
                "size": { "value": 5 },
                "color": { "value": "firebrick" },
                "stroke": { "value": "firebrick" },

            }
        }
    }
}