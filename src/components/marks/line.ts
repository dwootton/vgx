import { BaseComponent } from "../base";
import { Field, isContinuousFieldOrDatumDef } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import { compilationContext } from '../../binding/binding';
import { AnchorProxy, AnchorIdentifer, SchemaType } from "../../types/anchors";

import { generateSignalFromAnchor, createRangeAccessor, generateCompiledValue, generateSignalsFromTransforms, generateSignal } from "../utils";
import { extractSignalNames } from "../../binding/mergedComponent_CLEAN";

const lineBaseContext = {
    "start":{
        "x": 0,
        "y": 0
    },
    "stop":{
        "x": 1000,
        "y": 1000
    },
   
    "color": "'red'",
    "stroke": "'white'"
}
// Define the configurations with schemas and transforms
const configurations = [{
    'id': 'position',
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
            // "interactive": true
        }
    },
    "transforms": [
        { "name": "x_start", "channel": "x", "value": "PARENT_ID.start.x" }, // treat x like a scalar
        { "name": "x_stop", "channel": "x", "value": "PARENT_ID.stop.x" }, // treat x like a scalar
        { "name": "y_start", "channel": "y", "value": "PARENT_ID.start.y" },
        { "name": "y_stop", "channel": "y", "value": "PARENT_ID.stop.y"}, //data set y value will be each y value.
    ]
},{
    'id': 'x',
    "default": true,
    "schema": {
        "x": {
            "container": "Scalar",
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
        { "name": "x", "channel": "x", "value": "PARENT_ID.x.start" },
        { "name": "x_start", "channel": "x", "value": "PARENT_ID.start.x" }, // treat x like a scalar
        { "name": "x_stop", "channel": "x", "value": "PARENT_ID.stop.x" }, // treat x like a scalar
        { "name": "y_start", "channel": "y", "value": "PARENT_ID.start.y" },
        { "name": "y_stop", "channel": "y", "value": "PARENT_ID.stop.y"}, //data set y value will be each y value.
    ]
},{
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
        { "name": "x_start", "channel": "x", "value": "PARENT_ID.start.x" },
        { "name": "x_stop", "channel": "x", "value": "PARENT_ID.stop.x" },
        { "name": "y_start", "channel": "y", "value": "PARENT_ID.start.y" },
        { "name": "y_stop", "channel": "y", "value": "PARENT_ID.stop.y" },
    ]
}];



import { generateConfigurationAnchors } from "../interactions/drag2";


export class Line extends BaseComponent {
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


      
    }

    compileComponent(inputContext: compilationContext): Partial<UnitSpec<Field>> {
        const nodeId = inputContext.nodeId || this.id;



        // // TODO handle missing key/anchors
        // const outputSignals = Object.keys(this.schema).map(key =>
        //     generateSignalFromAnchor(inputContext[key] || [], key, this.id, nodeId, this.schema[key].container)
        // ).flat();

        // Generate all signals from configurations
        let generatedSignals = Object.values(this.configurations)
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
                const generatedSignals = generateSignalsFromTransforms(
                    config.transforms,
                    nodeId,
                    signalPrefix,
                    constraintMap
                );

                return generatedSignals.map(signal => {
                    signal.expr= signal.on.find(on=>!!on.update)?.update
                    return signal
                })
            });

            
            let outputSignals = (generatedSignals)





            const internalSignals = [...this.anchors.keys()]
            .filter(key => key.endsWith('_internal'))
            .map(key => {
                //no need to get constraints as constraints would have had it be already
                // get the transform 
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
                    "value": lineBaseContext,
                },
                ...outputSignals,
                ...internalSignals
            ],
            "data":{"values":[{}]}, //TODO FIX
            mark: {
                type: "rule",
                name: `${this.id}_marks`
            },
            "encoding": {
                "x": {
                    "value": { "expr": `${this.id}_position_x_start` },
                },
                "y": {
                    "value": { "expr": `${this.id}_position_y_start` },
                },
                "x2": {
                    "value": { "expr": `${this.id}_position_x_stop` },
                },
                "y2": {
                    "value": { "expr": `${this.id}_position_y_stop` },
                },
                "size": {"value": {"expr": 1}},
                "color": {"value": {"expr": "'red'"}},
                "stroke": {"value": {"expr": "'red'"}}
                // "stroke": {
                //     "value": { "expr": inputContext.stroke || circleBaseContext.stroke }
                // }
            }
        }
    }
}