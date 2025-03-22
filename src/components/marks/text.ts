import { BaseComponent } from "../base";
import { Field, isContinuousFieldOrDatumDef } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import { compilationContext } from '../../binding/binding';
import { AnchorProxy, AnchorIdentifer, SchemaType } from "../../types/anchors";

import { generateSignalFromAnchor, createRangeAccessor, generateCompiledValue, generateSignalsFromTransforms, generateSignal } from "../utils";
import { extractSignalNames } from "../../binding/mergedComponent_CLEAN";


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
            "container": "Scalar",
            "valueType": "Categorical",
            // "interactive": true
        },
        "data": {
            "container": "Data",
            "valueType": "Data",
            // "interactive": true
        },
        "markName": {
            "container": "Scalar",
            "valueType": "Categorical",
            // "interactive": true
        },
       
    },
    "transforms": [
        { "name": "x", "channel": "x", "value": "PARENT_ID.x" },
        { "name": "y", "channel": "y", "value": "PARENT_ID.y" },
        // { "name": "text", "channel": "text", "value": "PARENT_ID.text" }
    ]
}];


/*
{
    'id': 'appearance',
    "schema": {
        "fontSize": {
            "container": "Scalar",
            "valueType": "Numeric"
        },
        "color": {
            "container": "Scalar",
            "valueType": "String"
        },
        "align": {
            "container": "Scalar",
            "valueType": "String"
        },
        "baseline": {
            "container": "Scalar",
            "valueType": "String"
        },
        "opacity": {
            "container": "Scalar",
            "valueType": "Numeric"
        }
    },
    "transforms": [
        { "name": "fontSize", "channel": "fontSize", "value": "PARENT_ID.fontSize" },
        { "name": "color", "channel": "color", "value": "PARENT_ID.color" },
        { "name": "align", "channel": "align", "value": "PARENT_ID.align" },
        { "name": "baseline", "channel": "baseline", "value": "PARENT_ID.baseline" },
        { "name": "opacity", "channel": "opacity", "value": "PARENT_ID.opacity" }
    ]
}
*/

import { generateConfigurationAnchors } from "../interactions/drag2";
export class Text extends BaseComponent {
    public schema: Record<string, SchemaType>;
    public configurations: Record<string, any>;
    public baseConfig: any;
    constructor(config: any = {}) {
        super({ ...config })

        this.baseConfig = config;
        if(!config.text){
            this.baseConfig.text = {'expr':"'Text!'"}
        }
        this.configurations = {};
        configurations.forEach(cfg => {
            this.configurations[cfg.id] = cfg;
        });

        // Set up the main schema from configurations
        this.schema = {};
 

        configurations.forEach(config => {
            this.configurations[config.id] = config
            const schema = config.schema
            for (const key in schema) {
                const schemaValue = schema[key as keyof typeof schema];
                const keyName = config.id + '_' + key
                this.schema[keyName] = schemaValue;


                this.anchors.set(keyName, this.createAnchorProxy({ [keyName]: schemaValue }, keyName, () => {
                    
                    const generatedAnchor = generateConfigurationAnchors(this.id, config.id, key, schemaValue)
                    console.log('generatedAnchor', generatedAnchor)
                    return generatedAnchor
                }));
            }
      
        });

    }

    compileComponent(inputContext: compilationContext): Partial<UnitSpec<Field>> {
        const nodeId = inputContext.nodeId || this.id;
        console.log('compiling text', this.id,inputContext)


        // Base text signal
        const signal = {
            name: this.id,
            value: textBaseContext
        };

        // Generate all signals from configurations
        const outputSignals = Object.values(this.configurations)
            .filter(config => Array.isArray(config.transforms)) // Make sure transforms exist
            .flatMap(config => {
                // Build constraint map from inputContext
                const constraintMap: Record<string, any> = {};
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
                const constraints = inputContext[key]  || ["VGX_SIGNAL_NAME"];
               
                const config = this.configurations[key.split('_')[0]];
                const compatibleTransforms = config.transforms.filter((transform: any) => transform.channel === key.split('_')[1])
                return compatibleTransforms.map((transform: any) => generateSignal({
                    id: nodeId,
                    transform: transform,
                    output: nodeId + '_' + key,
                    constraints: constraints
                }))
            }
             
            ).flat();
       
        let dataAccessor = inputContext?.position_data?.[0]? {'name':inputContext?.position_data?.[0]} : {"values":[{}]};

        return {
            params: [
                {
                    "name": this.id,
                    "value": textBaseContext,
                },
                ...outputSignals,
                ...internalSignals
            ],
            "data": dataAccessor,
            name: `${this.id}_position_markName`,
           
            mark: {
                        type: "text",
                        "size": 20,
                        "align": "left",
                        "color": "firebrick",
                    },
           
            "encoding": {
                "x": {
                    "value": { "expr": `${this.id}_position_x` },
                },
                "y": {
                    "value": { "expr": `${this.id}_position_y` },
                },
                "text": {
                    // "value": { "expr": `${this.id}_position_text` },
                    "value": {"expr":`datum.count`}
                },
            }
        }
    }
}