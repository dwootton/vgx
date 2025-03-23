import { CombinedDrag, dragBaseContext, generateConfigurationAnchors } from "../Drag";
import { Rect } from "../../marks/rect";
import { BaseComponent } from "../../base";
import { extractAllNodeNames, generateSignal, generateSignalsFromTransforms } from "../../utils";
import { UnitSpec } from "vega-lite/build/src/spec";
import { Field } from "vega-lite/build/src/channeldef";
import { DataAccessor } from "../../DataAccessor";
import { BindingManager } from "../../../binding/BindingManager";
import { extractComponentBindings } from "../../../binding/utils";


export class BrushConstructor {
    id: string;
    constructor(config: any) {
        
        
        
        // Get all components that need to be bound
        const allBindings = extractComponentBindings(config);

        

        const brush = new Brush(config);
        

        this.id = brush.id;

        const drag = new CombinedDrag({ bind: [...allBindings,{ span: new Rect({ "strokeDash": [6, 4],'stroke':'firebrick','strokeWidth':2,'strokeOpacity':0.7,'fillOpacity':0.2,'fill':'firebrick'}) },brush] });

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
    },
    "transforms": [
    //     {
    //     "name": "x",
    //     "channel": "x",
    //     "value": "PARENT_ID.x" // replace the parent id + get the channel value
    // },
    // {
    //     "name": "y",
    //     "channel": "y",
    //     "value": "PARENT_ID.y" // replace the parent id + get the channel value
    // } 
    //BROKEN, but not used for signals rn
    { "name": "x_start", "channel": "x", "value": "PARENT_ID_x[0]" },
    { "name": "x_stop", "channel": "x", "value": "PARENT_ID_x[1]" },
    { "name": "y_start", "channel": "y", "value": "50" },
    // { "name": "y_stop", "channel": "y", "value": "PARENT_ID.stop.y" },
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
        "value": "(PARENT_ID_interval_x_start+PARENT_ID_interval_x_stop)/2" // replace the parent id + get the channel value
    },
    {
        "name": "y",
        "channel": "y",
        "value": "PARENT_ID_interval_y_start" // replace the parent id + get the channel value
    }
    ]
}]


export class Brush extends BaseComponent {
    _data: DataAccessor;
    accessors: DataAccessor[];
    constructor(config: any = {}) {
        super(config);
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


    }

    
        // Getter for data accessor
    get data(): DataAccessor {
        const accessor= new DataAccessor(this);
        this.accessors.push(accessor);
        return accessor.filter(`vlSelectionTest(${this.id}_store, datum)`)
    }

    compileComponent(inputContext: CompilationContext): Partial<UnitSpec<Field>> {
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


        const xNodeStart = extractAllNodeNames(inputContext['interval_x'].find(constraint => constraint.includes('start')))[0]
        const xNodeStop = extractAllNodeNames(inputContext['interval_x'].find(constraint => constraint.includes('stop')))[1]

        const yNodeStart = extractAllNodeNames(inputContext['interval_y'].find(constraint => constraint.includes('start')))[0]
        const yNodeStop = extractAllNodeNames(inputContext['interval_y'].find(constraint => constraint.includes('stop')))[1]



        const selectionModifications = [{"name":"VGXMOD_"+this.id+"_x","on":[{"events":[{"signal":xNodeStart},{"signal":xNodeStop}],"update":`[${xNodeStart},${xNodeStop}]`}]},
                                        {"name":"VGXMOD_"+this.id+"_y","on":[{"events":[{"signal":yNodeStart},{"signal":yNodeStop}],"update":`[${yNodeStart},${yNodeStop}]`}]}]

        
        return {
            params: [selection, ...selectionModifications]
        }
    }
}
