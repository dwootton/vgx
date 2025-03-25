import { BaseComponent } from "../base";
import { Field, isContinuousFieldOrDatumDef } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import {compilationContext} from '../../binding/binding';
import { AnchorProxy, AnchorIdentifer } from "types/anchors";
import { generateAnchorsFromContext } from "../../utils/anchorProxy";
import { generateComponentSignalName } from "../../utils/component";
import { generateParams } from "../../utils/compilation";
import { generateSignalFromAnchor, createRangeAccessor, generateSignalsFromTransforms, generateSignal } from "../utils";
import { generateConfigurationAnchors } from "../interactions/Drag";

const rectBaseContext = {
    "data": {"values":[{ "val1":"val2"}]},
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
        },
        "markName": {
            "container": "Scalar",
            "valueType": "Categorical",
            // "interactive": true
        },
    },
    "transforms": [
        { "name": "start_x", "channel": "x", "value": "BASE_NODE_ID.start.x" }, // treat x like a scalar
        { "name": "stop_x", "channel": "x", "value": "BASE_NODE_ID.stop.x" }, // treat x like a scalar
        { "name": "start_y", "channel": "y", "value": "BASE_NODE_ID.start.y" },
        { "name": "stop_y", "channel": "y", "value": "BASE_NODE_ID.stop.y"}, //data set y value will be each y value.
    ]
}];

export class Rect extends BaseComponent {
    public styles: any;

    constructor(config={}){
        super({...config},configurations)

        this.styles = config;

      
        

        // Set up the main schema from configurations
        this.schema = {};
        // Object.values(this.configurations).forEach(config => {
        //     Object.entries(config.schema).forEach(([key, value]) => {
        //         this.schema[key] = value as SchemaType;
        //     });
        // });

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
         
    }

   

    

    compileComponent(inputContext:compilationContext): Partial<UnitSpec<Field>> {
        const nodeId = inputContext.nodeId || this.id;

        // Generate all signals from configurations
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

                // Generate signals for this configuration
                return generateSignalsFromTransforms(
                    config.transforms,
                    nodeId,
                    signalPrefix,
                    constraintMap
                );
            });



            const internalSignals = [...this.anchors.keys()]
            .filter(key => key.endsWith('_internal'))
            .map(key => {
                //no need to get constraints as constraints would have had it be already
                // get the transform 
                const constraints = inputContext[key] || ["VGX_SIGNAL_NAME"];
               
                const configId = key.split('_')[0];
                const config = this.configurations.find(config => config.id === configId);
                const compatibleTransforms = config.transforms.filter(transform => transform.channel === key.split('_')[1])
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
                    "name":this.id,
                    "value":rectBaseContext,
                    // "expr":`{'x':{'start':${outputSignals[0].name},'stop':${outputSignals[1].name}},y:{'start':${outputSignals[2].name},'stop':${outputSignals[3].name}}}`
                },
                ...outputSignals,...internalSignals
            //     {
            //     "name":this.id,
            //     //@ts-ignore
            //     "expr":`{'x':{'start':${inputContext.x.start},'stop':${inputContext.x.stop}},'y':{'start':${inputContext.y.start},'stop':${inputContext.y.stop}}}`
            // }
            //     {
            //     // name: generateComponentSignalName(inputContext.nodeId),
            //     // //@ts-ignore, this is acceptable because params can take expr strings
            //     // expr: `{
            //     //     x1: ${inputContext.x1.fieldValue},
            //     //     x2: ${inputContext.x2.fieldValue},
                  
            //     // }`
            //     //  y1: ${inputContext.y1.fieldValue},
            //     //y2: ${inputContext.y2.fieldValue}
            // }
        ],
            data: inputContext.data || rectBaseContext.data,
            mark: {
                type: "rect",
                "stroke":this.styles.stroke,
                "strokeWidth":this.styles.strokeWidth,
                "fillOpacity":this.styles.fillOpacity,
                "fill":this.styles.fill,
                "strokeOpacity":this.styles.strokeOpacity,
                "strokeDash":this.styles.strokeDash,
        
            },
            "encoding":{
                "x":{
                    "value":{"expr":`${this.id}_position_start_x`},
                    //"type":"quantitative"
                },
                "x2":{
                    "value":{"expr":`${this.id}_position_stop_x`},
                    //"type":"quantitative"
                },
                "y":{
                    "value":{"expr":`${this.id}_position_start_y`},
                    //"type":"quantitative"
                },
                "y2":{
                    "value":{"expr":`${this.id}_position_stop_y`},
                    //"type":"quantitative"
                }
            }
        }
    }
}




