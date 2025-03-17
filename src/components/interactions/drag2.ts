import { BaseComponent } from "../base";
import { Field } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import { generateCompiledValue, generateSignalFromAnchor, createRangeAccessor, generateSignalsFromTransforms } from "../utils";
import { AnchorSchema, SchemaType, SchemaValue } from "types/anchors";
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

// x has encoding schema, y has encoding schema 
// top -> x1+y1, y1 => implies this must be a point, so for now lets limit it to only one interactor schema per bind
// 



// inputs: 
// element: string

// schema 
// span: 
// schema: range
// // events: 

// {
//         events: {
//             type: 'pointermove',
//             between: [
//                 { type: "pointerdown", "markname": inputContext.markName},
//                 { type: "pointerup" }
//             ]
//         },
//         update: `merge(${nodeId}, {'x': x(), 'y': y() })`
//     },

// any encoding types will compile down to 

// brush.top, this is a anchor for dragspan(y,x) and 
// when a new anchorname is bound, check top level anchor properties
// then if not, check the generated anchors from each schema. 

// anchornames are generated via taking in both schema types (x,y)
// 




/*export class DragSpan extends BaseComponent {
    public schemas: InteractorSchema[];
    constructor(config: any = {}) {
        super(config);

        this.schemas = [{
            schemaId: 'span',
            schemaType: 'Range',
            extractors: {'x':rangeExtractor('x'), 'y':rangeExtractor('y')}
        }];

        this.initializeAnchors();
    }

    compileComponent(inputContext: compilationContext): Partial<UnitSpec<Field>> {
        const nodeId = inputContext.nodeId || this.id;
        const signal = {
            name: this.id,
            value: dragBaseContext,
            on: [{
                events: {
                    type: 'pointermove',
                    between: [
                        { type: "pointerdown", "markname": inputContext.markName},
                        { type: "pointerup" }
                    ]
                },
                update: `merge(${nodeId}, {'start': {'x': x(), 'y': y()}, 'stop': {'x': x(), 'y': y()}})`
            }]
        };

        return {
            params: [signal, generateSignalFromSchema(this.schemas[0], 'x', this.id, nodeId), generateSignalFromSchema(this.schemas[0], 'y', this.id, nodeId )]
        };
    }
}*/

type constrain_expr = string;
// context: a mapping of property names to constraint expressions
type CompilationContext = Record<string, constrain_expr[]>;

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
        }
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



let createRangeAccessor = (id: string, channel: string, configurationId: string) => {
    return {
        'start': `${id}_${configurationId}_${channel}_start`,
        'stop': `${id}_${configurationId}_${channel}_stop`,
    }
}


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
                console.log('creating anchor for ', keyName)
                console.log('setting schema', keyName, schemaValue)
                this.schema[keyName] = schemaValue;


                this.anchors.set(keyName, this.createAnchorProxy({ [keyName]: schemaValue }, keyName, () => {
                    const generatedAnchor = generateConfigurationAnchors(this.id, config.id, key, schemaValue)
                    console.log('generatedAnchor', generatedAnchor)
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
        const nodeId = inputContext.nodeId || this.id;
        console.log('inputContext', inputContext, this.anchors)
        const signal = {
            name: this.id, // base signal
            value: dragBaseContext,
            on: [{ events: { type: 'pointerdown', 'markname': inputContext.markName }, update: `{'start': {'x': x(), 'y': y()}}` },
            {
                events: {
                    type: 'pointermove',
                    source: "window",
                    between: [
                        { type: "pointerdown", "markname": inputContext.markName },
                        { type: "pointerup", source: "window", }
                    ]
                },
                update: `merge(${nodeId}, {'x': x(), 'y': y(),  'stop': {'x': x(), 'y': y()}})`
            }]
        };

        console.log('fldragKEYSSS', Array.from(this.anchors.keys()));




        console.log('this.configurationsDRAG', this.configurations,inputContext)
        // Generate all signals
        const outputSignals = Object.values(this.configurations)
            .filter(config => Array.isArray(config.transforms)) // Make sure transforms exist
            .flatMap(config => {
                // Build constraint map from inputContext
                const constraintMap = {};
                console.log('in your config', config)
                Object.keys(config.schema).forEach(channel => {
                    const key = `${config.id}_${channel}`;
                    constraintMap[channel] = inputContext[key] || [];
                });

                const signalPrefix = this.id + '_' + config.id
                // Generate signals for this configuratio
                console.log('nodeID: ', 'constraintMap', constraintMap)
                return generateSignalsFromTransforms(
                    config.transforms,
                    nodeId,
                    signalPrefix,
                    constraintMap
                );
            });
        // Additional signals can be added here and will be available in input contexts
        const otherSignals = [];
        console.log('DRAG outputSignals', outputSignals)
        return {
            params: [signal, ...outputSignals]
        }
    }
}

export class Drag extends BaseComponent {
    constructor(config: any = {}) {
        super(config);

        this.schema = {
            'x': {
                container: 'Scalar',
                valueType: 'Numeric',
                interactive: true
            },
            'y': {
                container: 'Scalar',
                valueType: 'Numeric',
                interactive: true
            }
        }





        this.anchors.set('x', this.createAnchorProxy({ 'x': this.schema['x'] }, 'x', () => {
            return { 'value': generateCompiledValue(this.id, 'x') }
        }));

        this.anchors.set('y', this.createAnchorProxy({ 'y': this.schema['y'] }, 'y', () => {
            return { 'value': generateCompiledValue(this.id, 'y') }
        }));

    }

    compileComponent(inputContext: CompilationContext): Partial<UnitSpec<Field>> {
        const nodeId = inputContext.nodeId || this.id;
        const signal = {
            name: this.id, // base signal
            value: dragBaseContext,
            on: [{
                events: {
                    type: 'pointermove',
                    source: "window",
                    between: [
                        { type: "pointerdown", "markname": inputContext.markName },
                        { type: "pointerup", source: "window", }
                    ]
                },
                update: `merge(${nodeId}, {'x': x(), 'y': y()})`
            }]
        };



        // TODO handle missing key/anchors
        const outputSignals = Object.keys(this.schema).map(key => generateSignalFromAnchor(inputContext[key] || [`${this.id}_${key}`], key, this.id, nodeId, this.schema[key].container)).flat()
        // then , may through each item

        const internalSignals = Object.keys(inputContext).filter(key => key.endsWith('_internal')).map(key =>
            inputContext[key].map((updateStatement: string) => ({
                // const signal = generateSignalFromAnchor(['SIGNALVAL'],key,this.id,nodeId,this.schema[key].container)[0]

                // console.log('internalSignal', signal)
                name: this.id + '_' + key,
                "on": [{
                    "events": {
                        "signal": this.id
                    },
                    "update": updateStatement
                }]
            }))
        ).flat();

        if (internalSignals.length === 0) {
            // check if any of the inputContexts have merged components in them 
            const mergedComponents = Object.keys(inputContext).filter(key => inputContext[key].some(update => update.includes('merge')));

            const keys = mergedComponents

            const signals = [];
            for (const key of keys) {
                const signal = generateSignalFromAnchor(['SIGNALVAL'], key, this.id, nodeId, this.schema[key].container)[0]
                signals.push(signal)
                signal.name = signal.name + '_internal'
                internalSignals.push(signal);
            }

        }


        return {
            //@ts-ignore as signals can exist in VL
            params: [signal, ...outputSignals, ...internalSignals]

        };
    }
}


export class DragSpan extends BaseComponent {
    constructor(config: any = {}) {
        super(config);
        console.log('drag span config', config)

        this.schema = {
            'x': {
                container: 'Range',
                valueType: 'Numeric'
            },
            'y': {
                container: 'Range',
                valueType: 'Numeric'
            }
        }



        //   this.anchors.set('x', this.createAnchorProxy({'x':this.schema['x']}, 'x', () => {
        //     return createRangeAccessor(this.id,'x')
        //   }));


        this.anchors.set('x', this.createAnchorProxy({ 'x': this.schema['x'] }, 'x', () => {
            return createRangeAccessor(this.id, 'x')
        }));

        this.anchors.set('y', this.createAnchorProxy({ 'y': this.schema['y'] }, 'y', () => {
            return createRangeAccessor(this.id, 'y')
        }));

        //   this.anchors.set('y', this.createAnchorProxy({'y':this.schema['y']}, 'y', () => {
        //     return createRangeAccessor(this.id,'y')
        //   }));

    }

    compileComponent(inputContext: CompilationContext): Partial<UnitSpec<Field>> {

        const nodeId = inputContext.nodeId || this.id;
        const signal = {
            name: this.id,
            value: dragSpanBaseContext,
            on: [{
                events: {
                    type: 'pointermove',
                    source: "window",
                    between: [
                        { type: "pointerdown", "markname": inputContext.markName },
                        { type: "pointerup", source: "window", }
                    ]
                },
                update: `{'x':merge(${this.id}.x, {'stop':x()}), 'y':merge(${this.id}.y, {'stop':y()})}`

            }, {
                events: {
                    type: "pointerdown", "markname": inputContext.markName,
                },
                update: `{'x':{'start':x()},'y':{'start':y()}}`
            }]
        };


        // TODO handle missing key/anchors
        const outputSignals = Object.keys(this.schema).map(key =>
            generateSignalFromAnchor(inputContext[key] || [], key, this.id, nodeId, this.schema[key].container)
        ).flat()

        return {
            //@ts-ignore as signals can exist in VL
            params: [signal, ...outputSignals]

        };
    }
}
