import { BaseComponent } from "../base";
import { Field, isContinuousFieldOrDatumDef } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import { compilationContext } from '../../binding/binding';
import { AnchorProxy, AnchorIdentifer, SchemaType } from "../../types/anchors";

import { generateSignalFromAnchor, createRangeAccessor, generateCompiledValue, generateSignalsFromTransforms } from "../utils";
import { extractSignalNames } from "../../binding/mergedComponent_CLEAN";


export const circleBaseContext = {
    "x": 0,
    "y": 0,
    "size": 200,
    "color": "'steelblue'",
    "stroke": "'white'",
    "strokeWidth": 1,
    "opacity": 1
};

// Define the configurations with schemas and transforms
const configurations = [{
    'id': 'position',
    "default": true,
    "schema": {
        "x": {
            "container": "Scalar",
            "valueType": "Numeric",
            "interactive": true
        },
        "y": {
            "container": "Scalar",
            "valueType": "Numeric",
            "interactive": true
        }
    },
    "transforms": [
        { "name": "x", "channel": "x", "value": "PARENT_ID.x" },
        { "name": "y", "channel": "y", "value": "PARENT_ID.y" }
    ]
}, {
    'id': 'appearance',
    "schema": {
        "size": {
            "container": "Scalar",
            "valueType": "Numeric"
        },
        "color": {
            "container": "Scalar",
            "valueType": "String"
        },
        "stroke": {
            "container": "Scalar",
            "valueType": "String"
        },
        "strokeWidth": {
            "container": "Scalar",
            "valueType": "Numeric"
        },
        "opacity": {
            "container": "Scalar",
            "valueType": "Numeric"
        }
    },
    "transforms": [
        { "name": "size", "channel": "size", "value": "PARENT_ID.size" },
        { "name": "color", "channel": "color", "value": "PARENT_ID.color" },
        { "name": "stroke", "channel": "stroke", "value": "PARENT_ID.stroke" },
        { "name": "strokeWidth", "channel": "strokeWidth", "value": "PARENT_ID.strokeWidth" },
        { "name": "opacity", "channel": "opacity", "value": "PARENT_ID.opacity" }
    ]
}];

export class Circle extends BaseComponent {
    public schema: Record<string, SchemaType>;
    public configurations: Record<string, any>;

    constructor(config: any = {}) {
        super({ ...config })

        this.configurations = {};
        configurations.forEach(cfg => {
            this.configurations[cfg.id] = cfg;
        });

        // Set up the main schema from configurations
        this.schema = {};
        Object.values(this.configurations).forEach(config => {
            Object.entries(config.schema).forEach(([key, value]) => {
                this.schema[key] = value as SchemaType;
            });
        });

        // Create anchors for each schema item
        Object.keys(this.schema).forEach(key => {
            this.anchors.set(key, this.createAnchorProxy({ [key]: this.schema[key] }, key, () => {
                if (this.schema[key].container === 'Range') {
                    return createRangeAccessor(this.id, key);
                } else {
                    return { 'value': generateCompiledValue(this.id, key) };
                }
            }));
        });
    }

    compileComponent(inputContext: compilationContext): Partial<UnitSpec<Field>> {
        const nodeId = inputContext.nodeId || this.id;


        // Base circle signal
        const signal = {
            name: this.id,
            value: circleBaseContext
        };

        // TODO handle missing key/anchors
        const outputSignals = Object.keys(this.schema).map(key =>
            generateSignalFromAnchor(inputContext[key] || [], key, this.id, nodeId, this.schema[key].container)
        ).flat();

        // Generate all signals from configurations
        const outputSignals = Object.values(this.configurations)
            .filter(config => Array.isArray(config.transforms)) // Make sure transforms exist
            .flatMap(config => {
                // Build constraint map from inputContext
                const constraintMap = {};
                Object.keys(config.schema).forEach(channel => {
                    const key = `${config.id}_${channel}`;
                    constraintMap[channel] = inputContext[key] || inputContext[channel] || [];
                });

                const signalPrefix = this.id + '_' + config.id;

                // Generate signals for this configuration
                return generateSignalsFromTransforms(
                    config.transforms,
                    nodeId,
                    signalPrefix,
                    constraintMap
                );
            });

        // Handle internal signals (for merged components)
        const internalSignals = Object.keys(inputContext)
            .filter(key => key.endsWith('_internal'))
            .map(key =>
                inputContext[key].map((updateStatement: string) => ({
                    name: this.id + '_' + key,
                    "on": [{
                        "events": { "signal": this.id },
                        "update": updateStatement
                    }]
                }))
            ).flat();

        // // if there is an inputContext key that ends with _internal, then
        // // extract the channel from it {channel}_internal

        // const internalSignals = Object.keys(inputContext).filter(key => key.endsWith('_internal')).map(key =>
        //     inputContext[key].map((updateStatement: string) => {
        //         const channel = key.replace('_internal', '')
        //         const signal = generateSignalFromAnchor(['SIGNALVAL'], key, this.id, nodeId, this.schema[channel].container)[0]
        //         return {
        //             name: this.id + '_' + key,
        //             "on": [{
        //                 "events": {
        //                     "signal": this.id
        //                 },
        //                 "update": updateStatement.replace(/VGX_SIGNAL_NAME/g, `${this.id}_${key}`)
        //             }]
        //         }
        //     })).flat();

        // Create the mark specification
    // const mark = {
    //     type: "circle",
    //     encode: {
    //       update: {
    //         x: { signal: `${nodeId}_position_x` },
    //         y: { signal: `${nodeId}_position_y` },
    //         size: { signal: `${nodeId}_appearance_size` },
    //         fill: { signal: `${nodeId}_appearance_color` },
    //         stroke: { signal: `${nodeId}_appearance_stroke` },
    //         strokeWidth: { signal: `${nodeId}_appearance_strokeWidth` },
    //         opacity: { signal: `${nodeId}_appearance_opacity` }
    //       }
    //     }
    //   };


        return {
            params: [
                {
                    "name": this.id,
                    "value": circleBaseContext,
                },
                ...outputSignals,
                ...internalSignals
            ],
            data: inputContext.data || circleBaseContext.data,
            mark: {
                type: "circle",
                name: `${this.id}_marks`
            },
            "encoding": {
                "x": {
                    "value": { "expr": `${this.id}_position_x` },
                },
                "y": {
                    "value": { "expr": `${this.id}_position_y` },
                },
                "size": {
                    "value": { "expr": inputContext.size || circleBaseContext.size }
                },
                "color": {
                    "value": { "expr": inputContext.color || circleBaseContext.color }
                },
                "stroke": {
                    "value": { "expr": inputContext.stroke || circleBaseContext.stroke }
                }
            }
        }
    }
}