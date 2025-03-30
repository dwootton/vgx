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
        "data": {
            "container": "Absolute",
            "valueType": "Data",
            // "interactive": true
        },
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
        const {x,y,data} = inputContext.VGX_CONTEXT
        const allSignals = inputContext.VGX_SIGNALS
            
        return {
            params: [
                {
                    "name":this.id,
                    "value":rectBaseContext,
                    // "expr":`{'x':{'start':${outputSignals[0].name},'stop':${outputSignals[1].name}},y:{'start':${outputSignals[2].name},'stop':${outputSignals[3].name}}}`
                },
                ...allSignals
          
        ],
            data: data,
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
                "x":{"value":x.start},
                "y":{"value":y.start},
                "x2":{"value":x.stop},
                "y2":{"value":y.stop},
            }
        }
    }
}




