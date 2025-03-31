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
        { "name": "x", "channel": "x", "value": "BASE_NODE_ID.start.x" },
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

        console.log('CONFIGLINE', config)



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

        function generateDatasetFromContext(context: Record<string, any>) {
            const dataset = []
            for (const key in context) {
                if (typeof context[key] === 'object' && context[key] !== null) {
                    // Handle nested objects
                    for (const nestedKey in context[key]) {
                        dataset.push({ [`${key}_${nestedKey}`]: context[key][nestedKey] });
                    }
                } else {
                    // Handle non-nested values
                    dataset.push({ [key]: context[key] });
                }
            }
            return dataset;
        }


        const baseConfigId = this.configurations.find(c => c.default === true).id

        const triggerValues = generateDatasetFromContext(inputContext.VGX_CONTEXT).map(d => {

            const triggerKey = Object.keys(d)[0]
            const triggerValue = d[triggerKey]?.expr
            const updateValues = {}
            updateValues[triggerKey] = triggerValue
            return {trigger:triggerValue, modify:true, values:updateValues}


        }).filter(d => d.trigger !== undefined)
        console.log('datasetSchema', triggerValues)


        const lineDataName = 'lineData'+this.id
        const lineData = {
            name: "VGXMOD_"+lineDataName,
            // values: []//generateDatasetFromContext(inputContext.VGX_CONTEXT)
        }
        const triggers = {
            name: lineDataName,
            on: triggerValues
        }
        console.log('OURNEWdataset', triggerValues, x,y,lineData)

        let defaultdata = lineData

        if(inputContext.VGX_CONTEXT.data){
            console.log('in the data',inputContext.VGX_CONTEXT.data)
            defaultdata = lineData
            lineData.source = inputContext.VGX_CONTEXT.data.name;
            lineData.transform = [{
                "type":"formula",
                "as":"x_start",
                "expr":"datum.x",
            },
            {
                "type":"formula",
                "as":"x_stop",
                "expr":"datum.x",
                
            }, {
                "type":"formula",
                "as":"y_stop",
                "expr":"300",
                
            },{
                "type":"formula",
                "as":"y_start",
                "expr":"0",
                
            }]
            console.log('in the dataTransformed',lineData)

        }







        

        return {
            params: [
                {
                    "name": this.id,
                    "value": lineBaseContext,
                },
                ...allSignals,
            ],
            "data": lineData,
            name: `${this.id}_position_markName`,
            mark: {
                type: "rule",

            },
            "encoding": {
                "x": {
                    "value": {
                        "expr":"datum.x_start"
                    },
                },
                "y": {
                    "value": {
                        "expr":"datum.y_start"
                    },
                },
                "x2": {
                    "value": {
                        "expr":"datum.x_stop"
                    },
                },
                "y2": {
                    "value": y.stop,
                },
                "size": { "value": 5 },
                "color": { "value": "firebrick" },
                "stroke": { "value": "firebrick" },

            },
            // "triggers": [triggers]
        }
    }
}