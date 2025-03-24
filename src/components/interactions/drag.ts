import { BaseComponent } from "../base";
import { Field } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import { generateCompiledValue, generateSignalFromAnchor, createRangeAccessor, generateSignalsFromTransforms, generateSignal, generateAnchorId, calculateValueFor } from "../utils";
import { AnchorSchema, SchemaType, SchemaValue } from "../../types/anchors";

// context: a mapping of property names to constraint expressions
import { CompilationContext } from "../../binding/binding";
import { constructValueFromContext } from "../../utils/contextHelpers";


export const dragSpanBaseContext = { "x": { "start": 1, "stop": 100 }, "y": { "start": 1, "stop": 100 } };
export const dragBaseContext = { "x": 0, "y": 0 , start: {x:0,y:0}, stop: {x:0,y:0}};


const configurations = [{
    'id': 'point',
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
        },
        "markName": {
            "container": "Scalar",
            "valueType": "Categorical",
            // "restrictions":"input"
        }
    },
    "transforms": [{
        "name": "x",
        "channel": "x",
        "value": "BASE_NODE_ID.x" // replace the parent id + get the channel value
    },
    {
        "name": "y",
        "channel": "y",
        "value": "BASE_NODE_ID.y" // replace the parent id + get the channel value
    }
    ]
}, {
    'id': 'span',
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

    // OKAY RN TRANSFORMS ARENT USED lets fix this, adn git it populated, then we'll be doing great
    // transforms extract info from the underlying data, then can be parameterized
    "transforms": [
        { "name": "start_x", "channel": "x", "value": "BASE_NODE_ID.start.x" },
        { "name": "stop_x", "channel": "x", "value": "BASE_NODE_ID.stop.x" },
        { "name": "start_y", "channel": "y", "value": "BASE_NODE_ID.start.y" },
        { "name": "stop_y", "channel": "y", "value": "BASE_NODE_ID.stop.y" },
    ]
}, {
    'id': 'begin',
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
        { "name": "x", "channel": "x", "value": "BASE_NODE_ID.start.x" },
        { "name": "y", "channel": "y", "value": "BASE_NODE_ID.start.y" }
    ]
}]

const rectSide = {
    'id': 'left',
    "schema": {
        "x": {
            "container": "Scalar",
            "valueType": "Numeric",
        },
        "y": {
            "container": "Range",
            "valueType": "Numeric",
        }
    },
    "transforms": [{
        "x": {
            "update": "BASE_NODE_ID.x" // replace the parent id + get the channel value
        },
        "y": {
            "update": "{'min':BASE_NODE_ID.y.start, 'max':BASE_NODE_ID.y.stop}" // replace the parent id + get the channel value
        }
    }]
}

// okay, todo: go through and actually create the appropriate signals for each of these. Implement some anchor logic [span].x or something.


export function generateConfigurationAnchors(id: string, configurationId: string, channel: string, schema: SchemaType): SchemaValue {
    if (schema.container === 'Scalar') {
        return {
            'value': generateCompiledValue(id, channel, configurationId)
        }
    } else if (schema.container === 'Range') {
        return createRangeAccessor(id, channel, configurationId);
    } else if (schema.container === 'Data') {
        return {
            'value': `${id}_${configurationId}_${channel}`
        }
    }
    return { 'value': '' }
}


let generateCompiledValue = (id: string, channel: string, configurationId: string) => {
    return `${id}_${configurationId}_${channel}` // min value
}
import { areNamesCompatible } from "../utils";

export class CombinedDrag extends BaseComponent {
    constructor(config: any = {}) {
        super(config);
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

    compileComponent(inputContext: CompilationContext): Partial<UnitSpec<Field>> {
        console.log("DRAGINPUTCONTEXT", inputContext)

        // I want to generate all of of the signals for the configuration
        // I want to constrain any of the signals that are compoatible with a constraint from inputContext
        // then, for any of the signals that are constrained, I want to find the appropriate signals for constructing a value.
        // then, using the rleevant signals + relevant inputContext (other than the constrained signals intput):
        // then, using this relevant context I want to merge these signals into a single value that returns either a value, or a expr for use. 
        const nodeId = inputContext.nodeId || this.id;

        // Generate all signals
        const outputSignals = Object.values(this.configurations)
            .filter(config => Array.isArray(config.transforms)) // Make sure transforms exist
            .flatMap(config => {
                // Build constraint map from inputContext
                const constraintMap = {};
                Object.keys(config.schema).forEach(channel => {
                    const key = `${config.id}_${channel}`;
                    constraintMap[channel] = inputContext[key] || [];
                });

                const signalPrefix = this.id + '_' + config.id
                // Generate signals for this configuratio


                return generateSignalsFromTransforms(
                    config.transforms,
                    nodeId,
                    signalPrefix,
                    constraintMap
                );
            });


        // output signals + inputContext into 
        // I need configuration to know what the default signal is for each of the values 


        const markName = calculateValueFor('markName', inputContext, outputSignals, configurations);
        console.log('DRAGMARKNAME', markName)
        

        // const markName = calculateValueFor('markName', inputContext, outputSignals, configurations);


        console.log('markNamefsdfs', markName)
        // const markName = inputContext['point_markName']?.[0] ? inputContext['point_markName'][0]+"_marks" : '';






        // // const markName = inputContext['point_markName']?.[0] ? inputContext['point_markName'][0]+"_marks" : '';
        // const x1 = constructValueFromContext('x1', inputContext, this.id, configurations);
        // const x2 = constructValueFromContext('x2', inputContext, this.id, configurations);
        // // const y1 = constructValueFromContext('y1', inputContext, this.id, configurations);
        // // const y2 = constructValueFromContext('y2', inputContext, this.id, configurations);
        // // const markName = constructValueFromContext('markName', inputContext, this.id, configurations);


        // x1.value // reference to signal {expr:'signalName}, data field, {'expr':'datum[field]}, or value directly. 
        // x1.signals // array of signals

        const signal = {
            name: this.id, // base signal
            value: dragBaseContext,
            on: [{ events: { type: 'pointerdown', 'markname': markName+"_marks" }, update: `{'start': {'x': x(), 'y': y()}}` },
            {
                events: {
                    type: 'pointermove',
                    source: "window",
                    between: [
                        { type: "pointerdown", "markname": markName+"_marks" },
                        { type: "pointerup", source: "window", }
                    ]
                },
                update: `merge(${nodeId}, {'x': x(), 'y': y(),  'stop': {'x': x(), 'y': y()}})`
            }]
        };





        // Generate all signals
        // const outputSignals = Object.values(this.configurations)
        //     .filter(config => Array.isArray(config.transforms)) // Make sure transforms exist
        //     .flatMap(config => {
        //         // Build constraint map from inputContext
        //         const constraintMap = {};
        //         Object.keys(config.schema).forEach(channel => {
        //             const key = `${config.id}_${channel}`;
        //             constraintMap[channel] = inputContext[key] || [];
        //         });

        //         const signalPrefix = this.id + '_' + config.id
        //         // Generate signals for this configuratio


        //         return generateSignalsFromTransforms(
        //             config.transforms,
        //             nodeId,
        //             signalPrefix,
        //             constraintMap
        //         );
        //     });

        console.log('DRAGoutputSignals', outputSignals)
        // Additional signals can be added here and will be av  ilable in input contexts
        const internalSignals = [...this.anchors.keys()]
            .filter(key => key.endsWith('_internal'))
            .map(key => {
                //no need to get constraints as constraints would have had it be already
                // get the transform 
                const config = this.configurations[key.split('_')[0]];

                const compatibleTransforms = config.transforms.filter(transform => transform.channel === key.split('_')[1])


                console.log('key:',key,key.split('_'), this.configurations,config, key.split('_').filter(name=>name !== config.id).join('_'))

                const internalId = key.split('_').filter(name=>name !== config.id).join('_')

                const outputName = nodeId + '_' + internalId
                console.log('outputName',outputName)

                return compatibleTransforms.map(transform => generateSignal({
                    id: nodeId,
                    transform: transform,
                    output: outputName,
                    constraints: []
                }))
            }

            ).flat();
            console.log('draginternalSignals', internalSignals)




        const allSignals = [...outputSignals, ...internalSignals];
        console.log("ALLSIGNALSDRAG", allSignals)
        return {
            params: [signal, ...outputSignals, ...internalSignals]
        }
    }
}
