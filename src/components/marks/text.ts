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
    "text": "'Tedadxt'",
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
        const allSignals = inputContext.VGX_SIGNALS
    
        let {x,y,data,text} =  inputContext.VGX_CONTEXT

        return {
            params: [
                {
                    "name": this.id,
                    "value": textBaseContext,
                },
                ...allSignals,
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
                "x": {"value": x},
                "y": {"value": y},
                "text": {"value": text}

            }
        }
    }
}