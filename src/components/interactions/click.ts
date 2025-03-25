import { BaseComponent } from "../base";
import { Field } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import { CompilationContext } from '../../binding/binding';
import { SchemaType, SchemaValue } from "../../types/schema";
import { generateSignalsFromTransforms, generateSignal, createRangeAccessor } from "../utils";
import { constructValueFromContext } from "../../utils/contextHelpers";

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
}];

const clickBaseContext = {
    x: 0,
    y: 0,
    markName: null,
    clicked: false
};

 function generateConfigurationAnchors(id: string, configurationId: string, channel: string, schema: SchemaType): SchemaValue {
    if (schema.container === 'Scalar') {
        return {
            'value': generateCompiledValue(id, channel, configurationId)
        }
    } else if (schema.container === 'Range') {
        return createRangeAccessor(id, channel, configurationId);
    }
    return { 'value': '' }
}

let generateCompiledValue = (id: string, channel: string, configurationId: string) => {
    return `${id}_${configurationId}_${channel}` // min value
}

export class Click extends BaseComponent {
    public schema: Record<string, SchemaType>;
    public configurations: Record<string, any>;

    constructor(config: any = {}) {
        super(config);
        
        this.configurations = configurations;
        this.schema = {};
        
        configurations.forEach(config => {
            const schema = config.schema;
            for (const key in schema) {
                const schemaValue = schema[key];
                const keyName = config.id + '_' + key;
                this.schema[keyName] = schemaValue;

                this.anchors.set(keyName, this.createAnchorProxy({ [keyName]: schemaValue }, keyName, () => {
                    const generatedAnchor = generateConfigurationAnchors(this.id, config.id, key, schemaValue);
                    return generatedAnchor;
                }));
            }
        });
    }

    compileComponent(inputContext: CompilationContext): Partial<UnitSpec<Field>> {
        const nodeId = inputContext.nodeId || this.id;
        

        const {value:markName,signals:markNameSignals,data:markNameData} = constructValueFromContext(this.id + '_markName', inputContext, this.id, configurations);
        
        // Base click signal
        const signal = {
            name: this.id,
            value: clickBaseContext,
            on: [{
                events: { 
                    type: 'click', 
                    markname: inputContext.markName 
                },
                update: `{'x': x(), 'y': y(), 'clicked': true}`
            }]
        };

        // Generate all signals from configurations
        const outputSignals = Object.values(this.configurations)
            .filter(config => Array.isArray(config.transforms))
            .flatMap(config => {
                // Build constraint map from inputContext
                const constraintMap = {};
                Object.keys(config.schema).forEach(channel => {
                    const key = `${config.id}_${channel}`;
                    constraintMap[channel] = inputContext[key] || [];
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

        // Handle internal signals
        const internalSignals = [...this.anchors.keys()]
            .filter(key => key.endsWith('_internal'))
            .map(key => {
                const config = this.configurations[key.split('_')[0]];
                const compatibleTransforms = config.transforms.filter(transform => 
                    transform.channel === key.split('_')[1]
                );

                return compatibleTransforms.map(transform => generateSignal({
                    id: nodeId,
                    transform: transform,
                    output: nodeId + '_' + key,
                    constraints: ["VGX_SIGNAL_NAME"]
                }));
            }).flat();

        return {
            params: [signal, ...outputSignals, ...internalSignals]
        };
    }
}