import { CombinedDrag, dragBaseContext, generateConfigurationAnchors } from "../Drag";
import { Rect } from "../../marks/rect";
import { BaseComponent } from "../../base";
import { calculateValueFor, extractAllNodeNames, generateSignal, generateSignalsFromTransforms } from "../../utils";
import { UnitSpec } from "vega-lite/build/src/spec";
import { Field } from "vega-lite/build/src/channeldef";
import { DataAccessor } from "../../DataAccessor";
import { BindingManager } from "../../../binding/BindingManager";
import { extractComponentBindings } from "../../../binding/utils";
import { constructValueFromContext } from "../../../utils/contextHelpers";
import { Constraint } from "../../../binding/constraints";
const brushBaseContext = {
    "start":{
        "x": 0,
        "y": 0
    },
    "stop":{
        "x": 1000,
        "y": 1000
    },
   
    "color": "'firebrick'",
    "stroke": "'white'"
}

export class BrushConstructor {
    id: string;
    constructor(config: any) {
        
        
        
        // Get all components that need to be bound
        const allBindings = extractComponentBindings(config);

        

        const brush = new Brush(config);
        

        this.id = brush.id;

        const drag = new CombinedDrag({ bind: [...allBindings,{ span: [new Rect({ "strokeDash": [6, 4],'stroke':'firebrick','strokeWidth':2,'strokeOpacity':0.7,'fillOpacity':0.2,'fill':'firebrick'}),brush ]},] });

        
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

        bindingManager.removeComponent(drag.id);
        bindingManager.addComponent(dragProxy);

        brush.drag = dragProxy;
        
        // Return the proxy instead of the original drag object
        return dragProxy;

    }
}

type CompilationContext = Record<string, Constraint[]>;

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
    },
    "transforms": [
    //     {
    //     "name": "x",
    //     "channel": "x",
    //     "value": "BASE_NODE_ID.x" // replace the parent id + get the channel value
    // },
    // {
    //     "name": "y",
    //     "channel": "y",
    //     "value": "BASE_NODE_ID.y" // replace the parent id + get the channel value
    // } 
    //BROKEN, but not used for signals rn
    { "name": "start_x", "channel": "x", "value": "BASE_NODE_ID.start.x" },
    { "name": "stop_x", "channel": "x", "value": "BASE_NODE_ID.stop.x" },
    { "name": "start_y", "channel": "y", "value": "BASE_NODE_ID.start.y" },
    { "name": "stop_y", "channel": "y", "value": "BASE_NODE_ID.stop.y" },
    // { "name": "start_x", "channel": "x", "value": "BASE_NODE_ID_x[0]" },
    // { "name": "stop_x", "channel": "x", "value": "BASE_NODE_ID_x[1]" },
    // { "name": "start_y", "channel": "y", "value": "50" },
    // { "name": "stop_y", "channel": "y", "value": "BASE_NODE_ID.stop.y" },
    ]
},
{// STIL BROKEN
    'id': 'top',
    "schema": {
        "x": {
            "container": "Scalar",
            "valueType": "Numeric",
            // "interactive": true
        },
        "y": {
            "container": "Scalar",
            "valueType": "Numeric",
            // "interactive": true // TODO add back in when it won't screw with the chart domains
        },
    },
    "transforms": [{
        "name": "x",
        "channel": "x",
        "value": "(BASE_NODE_ID_interval_start_x+BASE_NODE_ID_interval_stop_x)/2" // replace the parent id + get the channel value
    },
    {
        "name": "y",
        "channel": "y",
        "value": "BASE_NODE_ID_interval_start_y" // replace the parent id + get the channel value
    }
    ]
}]


export class Brush extends BaseComponent {
    _data: DataAccessor;
    accessors: DataAccessor[];
    constructor(config: any = {},) {
        super(config,configurations);
        this._data = new DataAccessor(this);
        console.log('brush constructor', this._data)

        this.accessors = [];
        configurations.forEach(config => {
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


    }

    
        // Getter for data accessor
    get data(): DataAccessor {
        console.log('getting data accessor', this.id)
        const accessor= new DataAccessor(this);
        this.accessors.push(accessor);
        return accessor.filter(`vlSelectionTest(${this.id}_store, datum)`)
    }

    compileComponent(inputContext: CompilationContext): Partial<UnitSpec<Field>> {
        const selection = {
            "name": this.id+"_selection",
            "select": {
                "type": "interval",
                "mark": {
                    "fill": null,
                    "stroke": null,

                }
            }
        }

        const brushBaseSignal = {
            "name":this.id,
            "value":brushBaseContext
        }

        


        const outputSignals = Object.values(this.configurations)
            .filter(config => Array.isArray(config.transforms)) // Make sure transforms exist
            .flatMap(config => {
                // Build constraint map from inputContext
                const constraintMap = {};
                Object.keys(config.schema).forEach(channel => { 
                        const key = `${config.id}_${channel}`;
                    constraintMap[channel] = inputContext[key] || inputContext[channel] || [];
                });

                const signalPrefix = this.id + '_' + config.id;
                
                return generateSignalsFromTransforms(
                    config.transforms,
                    this.id,
                    signalPrefix,
                    constraintMap
                );
            }).flat();


        console.log("BRUSH CONTEXT", inputContext, configurations, outputSignals);
        // const xNodeStart = extractAllNodeNames(inputContext['interval_x'].find(constraint => constraint.includes('start')))[0]
        // const xNodeStop = extractAllNodeNames(inputContext['interval_x'].find(constraint => constraint.includes('stop')))[1]

        // const yNodeStart = extractAllNodeNames(inputContext['interval_y'].find(constraint => constraint.includes('start')))[0]
        // const yNodeStop = extractAllNodeNames(inputContext['interval_y'].find(constraint => constraint.includes('stop')))[1]



        // const {value:x1,signals:x1Signals,data:x1Data} = constructValueFromContext('x1', inputContext, this.id, configurations)
        // const {value:x2,signals:x2Signals,data:x2Data} = constructValueFromContext('x2', inputContext, this.id, configurations)

        // const {value:y1,signals:y1Signals,data:y1Data} = constructValueFromContext('y1', inputContext, this.id, configurations)
        // const {value:y2,signals:y2Signals,data:y2Data} = constructValueFromContext('y2', inputContext, this.id, configurations)

        // need to figure out how to get reasonable 

        // const outputSignals = Object.values(this.configurations)
        //     .filter(config => Array.isArray(config.transforms)) // Make sure transforms exist
        //     .flatMap(config => {
        //         // Build constraint map from inputContext
        //         const constraintMap = {};
        //         Object.keys(config.schema).forEach(channel => {
        //             const key = `${config.id}_${channel}`;
        //             console.log
        //             constraintMap[channel] = inputContext[key] || inputContext[channel] || [];
        //         });

        //         const signalPrefix = this.id + '_' + config.id;

        //         // Generate signals for this configuration
        //         return generateSignalsFromTransforms(
        //             config.transforms,
        //             this.id,
        //             signalPrefix,
        //             constraintMap
        //         );
        //     });


        console.log('calcuaitng brush, inputContext', inputContext, outputSignals)
        const x1 = calculateValueFor('x1', inputContext, outputSignals);
        const x2 = calculateValueFor('x2', inputContext, outputSignals);
        const y1 = calculateValueFor('y1', inputContext, outputSignals);
        const y2 = calculateValueFor('y2', inputContext, outputSignals);

        console.log('BRUSH CALCULATED x1', x1, 'x2', x2, 'y1', y1, 'y2', y2)
        



        const selectionModifications = [{"name":"VGXMOD_"+this.id+"_x","on":[{"events":[{"signal":x1.expr},{"signal":x2.expr}],"update":`[${x1.expr},${x2.expr}]`}]},
                                        {"name":"VGXMOD_"+this.id+"_y","on":[{"events":[{"signal":y1.expr},{"signal":y2.expr}],"update":`[${y1.expr},${y2.expr}]`}]}]

        
        // const additionalSignals = [...x1Signals, ...x2Signals, ...y1Signals, ...y2Signals] // should be empty

        
        return {
            params: [selection,...outputSignals,brushBaseSignal, ...selectionModifications]
        }
    }
}
