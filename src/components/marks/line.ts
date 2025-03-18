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

        console.log('this.anchors.line', this.anchors)

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


        console.log('inputContextLINE', inputContext)

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

                console.log('generatedSignals', generatedSignals)
                return generatedSignals.map(signal => {
                    signal.expr= signal.on.find(on=>!!on.update)?.update
                    console.log('signalEXPr', signal.expr)
                    return signal
                })
            });

            function removeEmptySignals(signals: any[]): any[] {
                return signals.filter(signal => {
                    console.log('signalUpdateCheck', signal, signal?.on, !signal?.on, signal.on?.length === 0);
                    
                    // If signal has no valid update mechanism (no expr, empty update, and no on events with updates)
                    // then only keep it if it has a non-empty value
                    if ((signal.expr === undefined || signal.expr === null || signal.expr === '') && 
                        (signal.update === undefined || signal.update === null || signal.update === '') && 
                        (!signal?.on || signal.on?.length === 0)) {
                        return !(signal.value === undefined || signal.value === null || signal.value === '');
                    }
                    
                    // Clean up empty update statements in 'on' array
                    if (signal.on && Array.isArray(signal.on)) {
                       
                        signal.on = signal.on.filter((onItem: any) => 
                            !(onItem.update === undefined || onItem.update === null || onItem.update === '')
                        );
                        if(signal.on?.length === 0){
                            return false;
                        }
                    }
                    
                    return true;
                });
            }


            let outputSignals = removeEmptySignals(generatedSignals)
            console.log('outputSignalsREMOVED', outputSignals)

            const [otherConfigurations, newOutputSignals] = fillInMissingContent(this.configurations, outputSignals)

            console.log('otherConfigurations', otherConfigurations)
            console.log('newOutputSignals', newOutputSignals)

            outputSignals = newOutputSignals
            console.log('changedOutput', outputSignals)




/**
 * Computes a default value based on schema container type and channel
 * @param schema The schema definition (contains container type)
 * @param transformName The name of the transform (e.g., x_start, y_stop)
 * @param channel The channel name (e.g., x, y)
 * @returns The appropriate default value
 */
function computeDefaultValue(schema, transformName, channel) {
    // Default values based on container type
    switch (schema.container) {
        case 'Range':
            // For ranges, use start/stop based on transform name
            if (transformName.endsWith('_start')) {
                return `range('${channel}')[1]`
            } else if (transformName.endsWith('_stop')) {
                return `range('${channel}')[0]`
            }
            return 0;
            
        case 'Scalar':
            // For scalars, use direct value
            if (channel === 'x' || channel === 'y') {
                return `(range('${channel}')[0]+range('${channel}')[1])/2`;
            } else if (channel === 'color' || channel === 'stroke') {
                return "'red'"; // Default color as string expression
            }
            return 0;
            
        case 'Set':
            // For sets, use first value or a reasonable default
            const values = lineBaseContext[channel]?.values;
            return values && values.length > 0 ? values[0] : 0;
        default:
            // Fallback to base context or zero
            return lineBaseContext[channel] || 0;
    }
}
            /**
 * Fills in missing values in configuration with defaults
 * @param configuration The configuration object that may have missing values
 * @param outputSignals The signals array that needs to be updated with defaults
 * @returns An object with updated configuration and signals
 */
function fillInMissingContent(configuration: any, outputSignals: any) {
    // Get the default configuration from your configurations array
    const defaultConfig = configurations.find(cfg => cfg.default === true);
    if (!defaultConfig) return { configuration, outputSignals };
    
    // For each schema item in the default configuration
    Object.entries(defaultConfig.schema || {}).forEach(([channel, schemaValue]) => {
        // Check if this channel is bound in the current configuration
        const isBound = outputSignals.some((signal: any) => 
            signal.name.includes(`_${defaultConfig.id}_${channel}`)
        );
        console.log('isBound', isBound, channel, `_${defaultConfig.id}_${channel}`);
        
        // If not bound, add default signals based on container type
        if (!isBound) {
            // Get transforms for this channel from the configuration
            const relevantTransforms = defaultConfig.transforms.filter(transform => 
                transform.channel === channel
            );
            
            // For each transform that needs a default value
            relevantTransforms.forEach(transform => {
                const signalName = `${nodeId}_${defaultConfig.id}_${transform.name}`;
                const defaultValue = computeDefaultValue(schemaValue, transform.name, channel);
                console.log('relevanttransform', defaultConfig, transform, signalName, defaultValue);
                
                // Check if the signal exists
                const existingSignalIndex = outputSignals.findIndex((s: any) => s.name === signalName);
                console.log('existingSignalIndex', existingSignalIndex);
                
                if (existingSignalIndex >= 0) {
                    // Update existing signal
                    outputSignals[existingSignalIndex] = {
                        name: signalName,
                        expr: defaultValue
                    };
                } else {
                    // Signal is missing entirely, create it
                    outputSignals.push({
                        name: signalName,
                        expr: defaultValue
                    });
                }
            });
        }
    });
    
    return [ configuration, outputSignals ];
}

        // function fillInMissingContent(configuration, outputSingals) {
        //     // e.g. elaborate missing bits of information
        //     // grab default configuration. 
        //     // then for each schema value in it, if its not bound, change each of its corresponding signals to be the default value 
        //     // create a function that computes the default value based on the container type. 
        //     // return the updated configuration and updated signals. 
          
            
        // }

            const internalSignals = [...this.anchors.keys()]
            .filter(key => key.endsWith('_internal'))
            .map(key => {
                //no need to get constraints as constraints would have had it be already
                // get the transform 
                const constraints = inputContext[key] || ["VGX_SIGNAL_NAME"];
               
                console.log('keys', key, key.split('_'), this.configurations)
                const config = this.configurations[key.split('_')[0]];
                console.log('generatedKEYSIGNAL', config, config.transforms)
                const compatibleTransforms = config.transforms.filter(transform => transform.channel === key.split('_')[1])
                console.log('compatibleTransforms', compatibleTransforms)
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