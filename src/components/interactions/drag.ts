import { BaseComponent } from "../base";
import { Field } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import { generateCompiledValue, generateSignalFromAnchor, createRangeAccessor, generateSignalsFromTransforms, generateSignal } from "../utils";
import { AnchorSchema, SchemaType, SchemaValue } from "../../types/anchors";

// context: a mapping of property names to constraint expressions
import { CompilationContext } from "../../binding/binding";
import { constructValueFromContext } from "../../utils/contextHelpers";


export const dragSpanBaseContext = { "x": { "start": 1, "stop": 100 }, "y": { "start": 1, "stop": 100 } };
export const dragBaseContext = { "x": 0, "y": 0 };

const currentExtractor = (channel: string) => ({
    type: 'Scalar',
    channel: channel,
    update: `VGX_SIGNAL_NAME.${channel}`
});

const rangeExtractor = (channel: string) => ({
    type: 'Range',
    channel: channel,
    update: `{
        start: VGX_SIGNAL_NAME.start.${channel},
        stop: VGX_SIGNAL_NAME.stop.${channel}
    }`
});

const startExtractor = (channel: string) => ({
    type: 'Scalar',
    channel: channel,
    update: `VGX_SIGNAL_NAME.start.${channel}`
});



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
                "interactive": true
            }
    },
    "transforms": [{
        "name": "x",
        "channel": "x",
        "value": "PARENT_ID.x" // replace the parent id + get the channel value
    },
    {
        "name": "y",
        "channel": "y",
        "value": "PARENT_ID.y" // replace the parent id + get the channel value
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
        { "name": "x_start", "channel": "x", "value": "PARENT_ID.start.x" },
        { "name": "x_stop", "channel": "x", "value": "PARENT_ID.stop.x" },
        { "name": "y_start", "channel": "y", "value": "PARENT_ID.start.y" },
        { "name": "y_stop", "channel": "y", "value": "PARENT_ID.stop.y" },
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
        { "name": "x", "channel": "x", "value": "PARENT_ID.start.x" },
        { "name": "y", "channel": "y", "value": "PARENT_ID.start.y" }
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
            "update": "PARENT_ID.x" // replace the parent id + get the channel value
        },
        "y": {
            "update": "{'min':PARENT_ID.y.start, 'max':PARENT_ID.y.stop}" // replace the parent id + get the channel value
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



// let createRangeAccessor = (id: string, channel: string, configurationId: string) => {
//     return {
//         'start': `${id}_${configurationId}_${channel}_start`,
//         'stop': `${id}_${configurationId}_${channel}_stop`,
//     }
// }


let generateCompiledValue = (id: string, channel: string, configurationId: string) => {
    return `${id}_${configurationId}_${channel}` // min value
}

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
            // this.anchors.set(config.id, this.createAnchorProxy({[config.id]: config.schema[config.id]}, config.id, () => {
            //     return generateConfigurationAnchors(this.id, config.id)
            // }));
        });
        // this.anchors.set('x', this.createAnchorProxy({ 'x': this.schema['x'] }, 'x', () => {
        //     return { 'value': generateCompiledValue(this.id, 'x') }
        // }));



    }

    compileComponent(inputContext: CompilationContext): Partial<UnitSpec<Field>> {

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


        console.log('compiling Dragvalue',outputSignals)
        // const markName = inputContext['point_markName']?.[0] ? inputContext['point_markName'][0]+"_marks" : '';
        console.log('anchorDRAG value',this.anchors)
        const x1 = constructValueFromContext('x1', inputContext, this.id, configurations);
        const x2 = constructValueFromContext('x2', inputContext, this.id, configurations);
        const y1 = constructValueFromContext('y1', inputContext, this.id, configurations);
        const y2 = constructValueFromContext('y2', inputContext, this.id, configurations);
        const markName = constructValueFromContext('markName', inputContext, this.id, configurations);


        x1.value // reference to signal {expr:'signalName}, data field, {'expr':'datum[field]}, or value directly. 
        x1.signals // array of signals

        const signal = {
            name: this.id, // base signal
            value: dragBaseContext,
            on: [{ events: { type: 'pointerdown', 'markname': markName.value }, update: `{'start': {'x': x(), 'y': y()}}` },
            {
                events: {
                    type: 'pointermove',
                    source: "window",
                    between: [
                        { type: "pointerdown", "markname": markName.value },
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


                return compatibleTransforms.map(transform => generateSignal({
                    id: nodeId,
                    transform: transform,
                    output: nodeId + '_' + key,
                    constraints: ["VGX_SIGNAL_NAME"]
                }))
            }
             
            ).flat();
        return {
            params: [signal, ...outputSignals, ...internalSignals]
        }
    }
}
