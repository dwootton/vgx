import { BaseComponent } from "../base";
import { Field, isContinuousFieldOrDatumDef } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import { compilationContext } from '../../binding/binding';
import { AnchorProxy, AnchorIdentifer, SchemaType } from "../../types/anchors";

import { generateSignalFromAnchor, createRangeAccessor, generateCompiledValue, generateSignalsFromTransforms, generateSignal } from "../utils";
import { extractSignalNames } from "../../binding/mergedComponent";


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
            "container": "Absolute",
            "valueType": "Categorical",
            // "interactive": true
        }
    },
    "transforms": [
        { "name": "x", "channel": "x", "value": "BASE_NODE_ID.x" },
        { "name": "y", "channel": "y", "value": "BASE_NODE_ID.y" }
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
        { "name": "size", "channel": "size", "value": "BASE_NODE_ID.size" },
        { "name": "color", "channel": "color", "value": "BASE_NODE_ID.color" },
        { "name": "stroke", "channel": "stroke", "value": "BASE_NODE_ID.stroke" },
        { "name": "strokeWidth", "channel": "strokeWidth", "value": "BASE_NODE_ID.strokeWidth" },
        { "name": "opacity", "channel": "opacity", "value": "BASE_NODE_ID.opacity" }
    ]
}
*/
import { generateConfigurationAnchors } from "../interactions/Drag";
export class Circle extends BaseComponent {
    public schema: Record<string, SchemaType>;

    constructor(config: any = {}) {
        super({ ...config },configurations)

       

        // Set up the main schema from configurations
        this.schema = {};
        // Object.values(this.configurations).forEach(config => {
        //     Object.entries(config.schema).forEach(([key, value]) => {
        //         this.schema[key] = value as SchemaType;
        //     });
        // });

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

    }

    compileComponent(inputContext: compilationContext): Partial<UnitSpec<Field>> {
        const {x,y,markName} = inputContext.VGX_CONTEXT
        // const allSignals = inputContext.VGX_SIGNALS




        return {
            params: [
                {
                    "name": this.id,
                    "value": circleBaseContext,
                },
            ],
            "data":{"values":[{}]}, //TODO FIX
            name: `${this.id}_position_markName`,
            mark: {
                type: "circle",
               
            },
            "encoding": {
                "x": {"value": x},
                "y": {"value": y},
                "size": {"value": 200},
                "color": {"value": "'firebrick'"},
                "stroke": {"value": "'white'"},
                "fill":{"value":"firebrick"}
            }
        }
    }
}