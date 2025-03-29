import { BaseComponent } from "../base";
import { Field, isContinuousFieldOrDatumDef } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import { compilationContext } from '../../binding/binding';
import { AnchorProxy, AnchorIdentifer, SchemaType } from "../../types/anchors";

import { generateSignalFromAnchor, createRangeAccessor, generateCompiledValue, generateSignalsFromTransforms, generateSignal } from "../utils";
import { extractSignalNames } from "../../binding/mergedComponent";
import { calculateValueFor } from "../resolveValue";

import { getEncodingValue } from '../../utils/encodingHelpers';
import { constructValueFromContext } from "../../utils/contextHelpers";

export const textBaseContext = {
    "x": 0,
    "y": 0,
    "text": "'Text'",
    "fontSize": 12,
    "color": "'steelblue'",
    "align": "'center'",
    "baseline": "'middle'",
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
        "text": {
            "container": "Absolute",
            "valueType": "Categorical",
            // "interactive": true
        },
    "data": {
        "container": "Absolute",
        "valueType": "Data",
        // "interactive": true
    },
        "markName": {
            "container": "Absolute",
            "valueType": "Categorical",
            // "interactive": true
        },


    },
    "transforms": [
        { "name": "x", "channel": "x", "value": "BASE_NODE_ID.x" },
        { "name": "y", "channel": "y", "value": "BASE_NODE_ID.y" },
        { "name": "text", "channel": "text", "value": "BASE_NODE_ID.text" }
    ]
},{
    'id': 'text',
    "default": true,
    "schema": {
        "text": {
            "container": "Absolute",
            "valueType": "Categorical",
            // "interactive": true
        },
        


    },
    "transforms": [
        { "name": "text", "channel": "text", "value": "BASE_NODE_ID.text" }
    ]
}];


import { generateConfigurationAnchors } from "../interactions/Drag";

export class Text extends BaseComponent {
    public schema: Record<string, SchemaType>;
    public configurations: Record<string, any>;
    public baseConfig: any;
    constructor(config: any = {}) {
        super({ config }, configurations)

        this.baseConfig = config;
        if (!config.text) {
            this.baseConfig.text = { 'expr': "'Text!'" }
        }
        this.configurations = configurations;

        // Set up the main schema from configurations
        this.schema = {};


        configurations.forEach(config => {
            const schema = config.schema
            for (const key in schema) {
                const schemaValue = schema[key as keyof typeof schema];
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
        const nodeId = inputContext.nodeId || this.id;

        const signal = {
            name: this.id,
            value: textBaseContext
        };

        // // Build constraint map
        const constraintMap: Record<string, any> = {};

        // Generate all signals from configurations
        const outputSignals = this.configurations
            .flatMap(config => {
                let transforms = config.transforms || [];

                // Build constraint map from inputContext
                // const constraintMap: Record<string, any> = {};
                Object.keys(config.schema).forEach(channel => {
                    const key = `${config.id}_${channel}`;
                    constraintMap[channel] = inputContext[key] || inputContext[channel] || [];
                });
                console.log('constraintMap', constraintMap)

                // If
                // for (const channel in constraintMap) {
                //     if (constraintMap[channel] && constraintMap[channel].length > 0 && !transforms.some(t => t.channel === channel)) {
                //         // Use the first constraint value as the transform value
                //         console.warn('No transform for text compilation with channel', channel)
                //         continue;
                   
                //     }
                // }

                const signalPrefix = this.id + '_' + config.id;
                console.log('generating signals for', signalPrefix, transforms,constraintMap)

                // Generate signals for this configuration
                return generateSignalsFromTransforms(
                    transforms,
                    nodeId,
                    signalPrefix,
                    constraintMap
                );
            }).filter(signal => signal !== undefined);

        console.log('TextoutputSignals', outputSignals)
        const internalSignals = [...this.anchors.keys()]
            .filter(key => key.endsWith('_internal'))
            .map(key => {
                //no need to get constraints as constraints would have had it be already
                // get the transform 
                const constraints = inputContext[key] || ["VGX_SIGNAL_NAME"];

                const configId = key.split('_')[0];
                const config = this.configurations.find(config => config.id === configId);
                const compatibleTransforms = config.transforms.filter(transform => transform.channel === key.split('_')[1])
                return compatibleTransforms.map(transform => generateSignal({
                    id: nodeId,
                    transform: transform,
                    output: nodeId + '_' + key,
                    constraints: constraints
                }))
            }
            ).flat();



        // Check if there's a signal with name ending with 'position_text'
        const hasPositionTextSignal = outputSignals.some(signal =>
            signal.name && signal.name.endsWith('_position_text')
        );


        // If no position_text signal exists, add one
        if (!hasPositionTextSignal) {
            outputSignals.push({
                "name": `${this.id}_position_text`,
                "value": "SAMPLEtext"
            });
        }


        const allSignals = [...outputSignals, ...internalSignals];


        const rawDataName = calculateValueFor('data', inputContext, allSignals);
        const data = typeof rawDataName === 'string' ? {'name': rawDataName} : rawDataName;
        const text = calculateValueFor('text', inputContext, allSignals);
        const textExpr = {'expr': text}
        // ISSUE: these are returning a value (not a signal)
        const x = calculateValueFor('x', inputContext, allSignals);
        const xExpr = {'expr': x}
        const y = calculateValueFor('y', inputContext, allSignals);
        const yExpr = {'expr': y}


        console.log('textcalculated', x,y,data,text)
        return {
            params: [
                {
                    "name": this.id,
                    "value": textBaseContext,
                },
                ...outputSignals,
                ...internalSignals
            ],
            "data": data,
            name: `${this.id}_position_markName`,

            mark: {
                type: "text",
                "size": 20,
                "align": "left",
                "color": "firebrick",
            },
            "encoding": {
                "x": xExpr,
                "y": yExpr,
                "text": textExpr

            }
        }
    }
}