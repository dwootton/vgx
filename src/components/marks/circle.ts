import { BaseComponent } from "../base";
import { Field, isContinuousFieldOrDatumDef } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import { compilationContext } from '../../binding/binding';
import { AnchorProxy, AnchorIdentifer, SchemaType } from "../../types/anchors";

import { generateSignalFromAnchor, createRangeAccessor, generateCompiledValue, generateSignalsFromTransforms, generateSignal } from "../utils";
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
            // "interactive": true
        },
        "y": {
            "container": "Scalar",
            "valueType": "Numeric",
            // "interactive": true
        },
        "markName": {
            "container": "Scalar",
            "valueType": "Categorical",
            // "interactive": true
        }
    },
    "transforms": [
        { "name": "x", "channel": "x", "value": "PARENT_ID.x" },
        { "name": "y", "channel": "y", "value": "PARENT_ID.y" }
    ]
}];
/*
{
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
}
*/

import { generateConfigurationAnchors } from "../interactions/drag2";
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
        // Object.values(this.configurations).forEach(config => {
        //     Object.entries(config.schema).forEach(([key, value]) => {
        //         this.schema[key] = value as SchemaType;
        //     });
        // });

        configurations.forEach(config => {
            this.configurations[config.id] = config
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

        // // Create anchors for each schema item
        // Object.keys(this.schema).forEach(key => {
        //     const schemaValue = schema[key];
        //     const keyName = config.id + '_' + key
        //     console.log('creating anchor for ', keyName)
        //     console.log('setting schema', keyName, schemaValue)
        //     this.schema[keyName] = schemaValue;
        //     this.anchors.set(keyName, this.createAnchorProxy({ [keyName]: schemaValue }, keyName, () => {
        //         const generatedAnchor = generateConfigurationAnchors(this.id, config.id, key, schemaValue)
        //         console.log('generatedAnchor', generatedAnchor)
        //         return generatedAnchor
        //     }));
        // });
    }

    compileComponent(inputContext: compilationContext): Partial<UnitSpec<Field>> {
        const nodeId = inputContext.nodeId || this.id;


        // Base circle signal
        const signal = {
            name: this.id,
            value: circleBaseContext
        };

        // // TODO handle missing key/anchors
        // const outputSignals = Object.keys(this.schema).map(key =>
        //     generateSignalFromAnchor(inputContext[key] || [], key, this.id, nodeId, this.schema[key].container)
        // ).flat();

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


            const internalSignals = [...this.anchors.keys()]
            .filter(key => key.endsWith('_internal'))
            .map(key => {
                const constraints = inputContext[key] || ["VGX_SIGNAL_NAME"];
               
                const config = this.configurations[key.split('_')[0]];
                const compatibleTransforms = config.transforms.filter(transform => transform.channel === key.split('_')[1])
                return compatibleTransforms.map(transform => generateSignal({
                    id: nodeId,
                    transform: transform,
                    output: nodeId + '_' + key,
                    constraints: constraints
                }))
            }
             
            ).flat();
       

        return {
            params: [
                {
                    "name": this.id,
                    "value": circleBaseContext,
                },
                ...outputSignals,
                ...internalSignals
            ],
            "data":{"values":[{}]}, //TODO FIX
            name: `${this.id}_position_markName`,
            mark: {
                type: "circle",
               
            },
            "encoding": {
                "x": {
                    "value": { "expr": `${this.id}_position_x` },
                },
                "y": {
                    "value": { "expr": `${this.id}_position_y` },
                },
                "size": {"value": {"expr": 200}},
                "color": {"value": {"expr": "'firebrick'"}},
                "stroke": {"value": {"expr": "'white'"}}
                // "stroke": {
                //     "value": { "expr": inputContext.stroke || circleBaseContext.stroke }
                // }
            }
        }
    }
}