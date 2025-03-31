import { BaseComponent } from "../base";
import { Field } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import { generateCompiledValue, generateSignalFromAnchor, createRangeAccessor, generateSignalsFromTransforms, generateSignal, generateAnchorId } from "../utils";
import { AnchorSchema, SchemaType, SchemaValue } from "../../types/anchors";
import { calculateValueFor } from "../resolveValue";

// context: a mapping of property names to constraint expressions
import { CompilationContext } from "../../binding/binding";
import { constructValueFromContext } from "../../utils/contextHelpers";


export const dragSpanBaseContext = { "x": { "start": 1, "stop": 100 }, "y": { "start": 1, "stop": 100 } };
export const dragBaseContext = { "x": 0, "y": 0 , start: {x:0,y:0}, stop: {x:1000,y:1000}};


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
            "container": "Absolute",
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
            "interactive": true
        },
        "y": {
            "container": "Range",
            "valueType": "Numeric",
            "interactive": true // TODO add back in when it won't screw with the chart domains
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
    } else if (schema.container === 'Set') {
        const datasetName = `${id}_base_data`
        console.log('generateSETConfigurationAnchors', id, configurationId, channel, schema, datasetName,  `pluck(data(${datasetName}), '${channel}Value')`)
        return {
            'value': `pluck(data('${datasetName}'), '${channel}Value')`
        }
    }
    
    return { 'value': '' }
}


let generateCompiledValue = (id: string, channel: string, configurationId: string) => {
    return `${id}_${configurationId}_${channel}` // min value
}


export class CombinedDrag extends BaseComponent {
    constructor(config: any = {}) {
        super(config, configurations);
        
        this.configurations.forEach(config => {
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

    compileComponent(inputContext: CompilationContext): Partial<UnitSpec<Field>> {
        const allSignals = inputContext.VGX_SIGNALS
        const {markName} = inputContext.VGX_CONTEXT

        const signal = {
            name: this.id, // base signal
            value: dragBaseContext,
            on: [{ events: { type: 'pointerdown', 'markname': markName }, update: `{'start': {'x': x(), 'y': y()}}` },
            {
                events: {
                    type: 'pointermove',
                    source: "window",
                    between: [
                        { type: "pointerdown", "markname": markName },
                        { type: "pointerup", source: "window", }
                    ]
                },
                update: `merge(${this.id}, {'x': x(), 'y': y(),  'stop': {'x': x(), 'y': y()}})`
            }]
        };

       
        return {
            params: [signal, ...allSignals]
        }
    }
}


const dragSpanConfigurations = [{
    'id': 'span',
    "default": true,
    "schema": {
        "x": { "container": "Range", "valueType": "Numeric", "interactive": true },
        "y": { "container": "Range", "valueType": "Numeric", "interactive": true }
    },
    "transforms": [
        { "name": "start_x", "channel": "x", "value": "BASE_NODE_ID.start.x" },
        { "name": "stop_x", "channel": "x", "value": "BASE_NODE_ID.stop.x" },
        { "name": "start_y", "channel": "y", "value": "BASE_NODE_ID.start.y" },
        { "name": "stop_y", "channel": "y", "value": "BASE_NODE_ID.stop.y" },
    ]
}]
export class DragSpan extends BaseComponent {
    constructor(config: any = {}) {
        super(config, dragSpanConfigurations);
        
        this.configurations.forEach(config => {
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

    compileComponent(inputContext: CompilationContext): Partial<UnitSpec<Field>> {
        const allSignals = inputContext.VGX_SIGNALS
        const {markName} = inputContext.VGX_CONTEXT

        const signal = {
            name: this.id, // base signal
            value: dragBaseContext,
            on: [{ events: { type: 'pointerdown', 'markname': markName }, update: `{'start': {'x': x(), 'y': y()}}` },
            {
                events: {
                    type: 'pointermove',
                    source: "window",
                    between: [
                        { type: "pointerdown", "markname": markName },
                        { type: "pointerup", source: "window", }
                    ]
                },
                update: `merge(${this.id}, {'x': x(), 'y': y(),  'stop': {'x': x(), 'y': y()}})`
            }]
        };

       
        return {
            params: [signal, ...allSignals]
        }
    }
}