import { CombinedDrag, dragBaseContext, generateConfigurationAnchors } from "../drag2";
import { Rect } from "../../marks/rect";
import { BaseComponent } from "../../base";
import { extractAllNodeNames, generateSignal, generateSignalsFromTransforms } from "../../utils";
import { UnitSpec } from "vega-lite/build/src/spec";
import { Field } from "vega-lite/build/src/channeldef";
import { DataAccessor } from "../../DataAccessor";
import { BindingManager } from "../../../binding/BindingManager";
export class BrushConstructor {
    id: string;
    constructor(config: any) {
        
        // Extract all components from config and their bindings
        const extractComponentBindings = (config: any): any[] => {
            // If no config or no bind property, return empty array
            if (!config || !config.bind || typeof config.bind === 'function') {
                return [];
            }
            
            // If bind is an array, process each item
            if (Array.isArray(config.bind)) {
                return config.bind.flatMap(item => {
                    // If the item is a component with its own bindings, extract those too
                    if (item && typeof item === 'object' && item.bind) {
                        return [item, ...extractComponentBindings(item)];
                    }
                    return item;
                });
            }
            
            // If bind is a single object with its own bindings
            if (typeof config.bind === 'object' && config.bind.bind) {
                return [config.bind, ...extractComponentBindings(config.bind)];
            }
            
            // If bind is a single object without further bindings
            return [config.bind];
        };
        
        // Get all components that need to be bound
        const allBindings = extractComponentBindings(config);
        console.log('allBindings', allBindings)

        

        const brush = new Brush(config);
        

        this.id = brush.id;

        const drag = new CombinedDrag({ bind: [...allBindings,{ span: new Rect({ "strokeDash": [6, 4],'stroke':'firebrick','strokeWidth':2,'strokeOpacity':0.7,'fillOpacity':0.2,'fill':'firebrick'}) },brush] });


        // const brush = new Brush({ bind: drag });
        // console.log('passing through brush', brush, drag)
        // Create a proxy to intercept property access on drag
        const dragProxy = new Proxy(drag, {
            get(target, prop, receiver) {
                // If accessing 'data' property, redirect to brush.data
                if (prop === 'data') {
                    return brush._data;
                }
                if (prop === 'brush') {
                    return brush;
                }
                
                // For all other properties, use the original drag object
                return Reflect.get(target, prop, receiver);
            }
        });

        const bindingManager = BindingManager.getInstance();

        console.log('pre dragProxy',bindingManager.getComponents())
        bindingManager.removeComponent(drag.id);
        console.log('adding dragProxy',bindingManager.getComponents())
        bindingManager.addComponent(dragProxy);
        
        // Return the proxy instead of the original drag object
        return dragProxy;

        return drag; // pass through to the drag component, but still have parent edges via brush bind.
    }
}

type CompilationContext = Record<string, string[]>;

const configurations = [{
    'id': 'interval',
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
            // "interactive": true // TODO add back in when it won't screw with the chart domains
        },
        "data": {
            "container": "Data",
            "valueType": "Data",
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
}]


export class Brush extends BaseComponent {
    _data: DataAccessor;
    accessors: DataAccessor[];
    constructor(config: any = {}) {
        super(config);
        console.log('constructing brush', this, config)
        this._data = new DataAccessor(this);
        this.accessors = [];
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

        this._data.filter(`vlSelectionTest(${this.id}_store, datum)`)// any data referenced from the brush will be filtered

        // Add data as an anchor
        this.anchors.set('data', this.createAnchorProxy({ 
            'data': { 
            container: 'Data',
            valueType: 'Data',
            }
        }, 'data', () => {
            return { 'value': this._data };
        }));


    }

    
        // Getter for data accessor
    get data(): DataAccessor {
        console.log('getting data', this._data)
        const accessor= new DataAccessor(this);
        this.accessors.push(accessor);
        console.log('accessor', accessor)
        return accessor.filter(`vlSelectionTest(${this.id}_store, datum)`)
    }

    compileComponent(inputContext: CompilationContext): Partial<UnitSpec<Field>> {
        console.log('compiling brush', this, inputContext)
        const nodeId = inputContext.nodeId || this.id;
        console.log('inputContextDRAG', inputContext, nodeId)
        const markName = inputContext['point_markName']?.[0] ? inputContext['point_markName'][0] + "_marks" : '';
        const selection = {
            "name": this.id,
            "select": {
                "type": "interval",
                "mark": {
                    "fill": null,
                    "stroke": null,

                }
            }
        }

        console.log('compiling accessors', this.accessors)

        const xNodeStart = extractAllNodeNames(inputContext['interval_x'].find(constraint => constraint.includes('start')))[0]
        const xNodeStop = extractAllNodeNames(inputContext['interval_x'].find(constraint => constraint.includes('stop')))[1]

        const yNodeStart = extractAllNodeNames(inputContext['interval_y'].find(constraint => constraint.includes('start')))[0]
        const yNodeStop = extractAllNodeNames(inputContext['interval_y'].find(constraint => constraint.includes('stop')))[1]

        console.log('xNodes', xNodeStart, xNodeStop, 'yNodes', yNodeStart, yNodeStop)


        const selectionModifications = [{"name":"VGXMOD_"+this.id+"_x","on":[{"events":[{"signal":xNodeStart},{"signal":xNodeStop}],"update":`[${xNodeStart},${xNodeStop}]`}]},
                                        {"name":"VGXMOD_"+this.id+"_y","on":[{"events":[{"signal":yNodeStart},{"signal":yNodeStop}],"update":`[${yNodeStart},${yNodeStop}]`}]}]

        // const signal = {
        //     name: this.id, // base signal
        //     value: dragBaseContext,
        //     on: [{ events: { type: 'pointerdown', 'markname': markName }, update: `{'start': {'x': x(), 'y': y()}}` },
        //     {
        //         events: {
        //             type: 'pointermove',
        //             source: "window",
        //             between: [
        //                 { type: "pointerdown", "markname": markName },
        //                 { type: "pointerup", source: "window", }
        //             ]
        //         },
        //         update: `merge(${nodeId}, {'x': x(), 'y': y(),  'stop': {'x': x(), 'y': y()}})`
        //     }]
        // };





        // // Generate all signals
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
        // // Additional signals can be added here and will be av  ilable in input contexts
        // const internalSignals = [...this.anchors.keys()]
        //     .filter(key => key.endsWith('_internal'))
        //     .map(key => {
        //         //no need to get constraints as constraints would have had it be already
        //         // get the transform 
        //         const config = this.configurations[key.split('_')[0]];

        //         const compatibleTransforms = config.transforms.filter(transform => transform.channel === key.split('_')[1])


        //         return compatibleTransforms.map(transform => generateSignal({
        //             id: nodeId,
        //             transform: transform,
        //             output: nodeId + '_' + key,
        //             constraints: ["VGX_SIGNAL_NAME"]
        //         }))
        //     }

        //     ).flat();
        return {
            params: [selection, ...selectionModifications]
        }
    }
}

// steps :

// 1. change all anchors to be encoding anchors (such that we group on encoding type)