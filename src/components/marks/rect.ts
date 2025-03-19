import { BaseComponent } from "../base";
import { Field, isContinuousFieldOrDatumDef } from "vega-lite/build/src/channeldef";
import { UnitSpec } from "vega-lite/build/src/spec";
import {compilationContext} from '../../binding/binding';
import { AnchorProxy, AnchorIdentifer } from "types/anchors";
import { generateAnchorsFromContext } from "../../utils/anchorProxy";
import { generateComponentSignalName } from "../../utils/component";
import { generateParams } from "../../utils/compilation";
import { generateSignalFromAnchor, createRangeAccessor, generateSignalsFromTransforms, generateSignal } from "../utils";
import { generateConfigurationAnchors } from "../interactions/drag2";

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
   
    "color": "'red'",
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
        { "name": "x_start", "channel": "x", "value": "PARENT_ID.start.x" }, // treat x like a scalar
        { "name": "x_stop", "channel": "x", "value": "PARENT_ID.stop.x" }, // treat x like a scalar
        { "name": "y_start", "channel": "y", "value": "PARENT_ID.start.y" },
        { "name": "y_stop", "channel": "y", "value": "PARENT_ID.stop.y"}, //data set y value will be each y value.
    ]
}];

type RectConfig = {
    [K in keyof typeof rectBaseContext]?: typeof rectBaseContext[K]
}

export class Rect extends BaseComponent {

    constructor(config:RectConfig={}){
        super({...config})

      
        this.configurations = {};
        configurations.forEach(cfg => {
            this.configurations[cfg.id] = cfg;
        });

        // Set up the main schema from configurations
        this.schema = {};
        // Object.values(this.configurations).forEach(config => {
        //     Object.entries(config.schema).forEach(([key, value]) => {
        //         this.schema[key] = value as SchemaType;
        //     });
        // });

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

            console.log('outputSignalsRECT', outputSignals)


            const internalSignals = [...this.anchors.keys()]
            .filter(key => key.endsWith('_internal'))
            .map(key => {
                //no need to get constraints as constraints would have had it be already
                // get the transform 
                const constraints = inputContext[key] || ["VGX_SIGNAL_NAME"];
               
                const config = this.configurations[key.split('_')[0]];
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
                // x: { 
                //     expr:  `${this.id}_x_start`
                // },
                // x2: {
                //     expr:   `${this.id}_x_stop`
                // },
                // y: {
                //     expr:  `${this.id}_y_start`
                // },
                // y2: {
                //     expr:  `${this.id}_y_stop`
                // },
                // color: {
                //     expr: inputContext.color || rectBaseContext.color
                // },
                // stroke: {
                //     expr: inputContext.stroke || rectBaseContext.stroke
                // }
            },
            "encoding":{
                "x":{
                    "value":{"expr":`${this.id}_position_x_start`},
                    //"type":"quantitative"
                },
                "x2":{
                    "value":{"expr":`${this.id}_position_x_stop`},
                    //"type":"quantitative"
                },
                "y":{
                    "value":{"expr":`${this.id}_position_y_start`},
                    //"type":"quantitative"
                },
                "y2":{
                    "value":{"expr":`${this.id}_position_y_stop`},
                    //"type":"quantitative"
                }
            }
        }
    }
}




