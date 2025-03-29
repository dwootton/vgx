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
        super(config,configurations);
        
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
        
        const allSignals = inputContext.VGX_SIGNALS
        const {markName}= inputContext.VGX_CONTEXT
        
        // // Base click signal
        const signal = {
            name: this.id,
            value: clickBaseContext,
            on: [{
                events: { 
                    type: 'click', 
                    markname: markName 
                },
                update: `{'x': x(), 'y': y(), 'clicked': true}`
            }]
        };

        return {
            params: [signal, ...allSignals]
        };
    }
}