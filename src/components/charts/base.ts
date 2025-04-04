// src/charts/base.ts
import { TopLevelSpec } from 'vega-lite/build/src/spec';
import { UnitSpec, GenericUnitSpec } from 'vega-lite/build/src/spec/unit';
import { Encoding } from 'vega-lite/build/src/encoding';
import { Field, FieldDef, FieldDefBase } from 'vega-lite/build/src/channeldef';
import { StandardType } from 'vega-lite/build/src/type';
import { BaseComponent } from '../base';
import { getMainRangeChannel, PositionChannel } from 'vega-lite/build/src/channel';
import { AnchorProxy, ChannelType, RangeSchema, NumericScalar, SchemaType, SchemaValue } from '../../types/anchors';
import { generateConfigurationAnchors } from '../interactions/Drag';
export interface ChartConfig {
  data: any[];
  width?: number;
  height?: number;
  title?: string;
  padding?: number;
  mark?: any;
  // all channels will either be a fieldValue, fieldBinds,
  y: FieldProps | FieldProps[] | undefined;
  x: FieldProps | FieldProps[] | undefined;
  color: FieldValueProps | FieldValueProps[]; // no undefined as we will proivide a default
  size: FieldValueProps | FieldValueProps[];
  opacity: FieldValueProps | FieldValueProps[];
}


type FieldBinds = AnchorProxy
type FieldName = string
type FieldProps = FieldName | FieldBinds

import type { ExprRef, SignalRef } from 'vega';
import { Gradient } from 'vega-typings';
type FieldValue = string | ExprRef | SignalRef | Gradient | null

type FieldValueProps = FieldProps | FieldValue

// Base encoding definition for field-based encodings
export type FieldEncodingDef = {
  field: FieldName;
  type: StandardType;
};

// Base encoding definition for constant value-based encodings
type ValueEncodingDef = {
  value: FieldValue;
};

// General encoding definition that combines both options
type EncodingDef = FieldEncodingDef | ValueEncodingDef;

// Specific encoding for positional channels (only allows field-based encodings)
export type PositionEncodingDef = FieldEncodingDef;


type SplitConfig = {
  encodingBinds: Record<string, AnchorProxy>;
  encodingDefs: Record<string, EncodingDef | PositionEncodingDef>;
}

// Define our specific spec type that we know will have encoding
export type ChartSpec = Partial<UnitSpec<Field>>;
// Generate configurations for chart channels
const configurations = [
  {
    "id": 'plot',
    "default": true,
    "schema": {
      "x": {
        "container": "Range",
        "valueType": "Numeric"
      },
      "y": {
        "container": "Range",
        "valueType": "Numeric"
      },
      // "color": {
      //   "container": "Scalar",
      //   "valueType": "Numeric"
      // },
      // "size": {
      //   "container": "Scalar",
      //   "valueType": "Numeric"
      // },
      // "opacity": {
      //   "container": "Scalar",
      //   "valueType": "Numeric"
      // }
    },
    "transforms": [
      { "name": "x", "channel": "x", "value": "BASE_NODE_ID.x" },
      { "name": "y", "channel": "y", "value": "BASE_NODE_ID.y" },
      // { "name": "color", "channel": "color", "value": "BASE_NODE_ID.color" },
      // { "name": "size", "channel": "size", "value": "BASE_NODE_ID.size" },
      // { "name": "opacity", "channel": "opacity", "value": "BASE_NODE_ID.opacity" }
    ]
  },
  {
    "id": 'y',
    "schema": {
      // "x": {
      //   "container": "Range",
      //   "valueType": "Numeric"
      // },
      "y": {
        "container": "Range",
        "valueType": "Numeric"
      },
      // "color": {
      //   "container": "Scalar",
      //   "valueType": "Numeric"
      // },
      // "size": {
      //   "container": "Scalar",
      //   "valueType": "Numeric"
      // },
      // "opacity": {
      //   "container": "Scalar",
      //   "valueType": "Numeric"
      // }
    },
    "transforms": [
      // { "name": "x", "channel": "x", "value": "BASE_NODE_ID.x" },
      { "name": "y", "channel": "y", "value": "BASE_NODE_ID.y" },
      // { "name": "color", "channel": "color", "value": "BASE_NODE_ID.color" },
      // { "name": "size", "channel": "size", "value": "BASE_NODE_ID.size" },
      // { "name": "opacity", "channel": "opacity", "value": "BASE_NODE_ID.opacity" }
    ]
  },
  {
    "id": 'x',
    "schema": {
      "x": {
        "container": "Range",
        "valueType": "Numeric"
      },
      // "y": {
      //   "container": "Range",
      //   "valueType": "Numeric"
      // },
      // "color": {
      //   "container": "Scalar",
      //   "valueType": "Numeric"
      // },
      // "size": {
      //   "container": "Scalar",
      //   "valueType": "Numeric"
      // },
      // "opacity": {
      //   "container": "Scalar",
      //   "valueType": "Numeric"
      // }
    },
    "transforms": [
      { "name": "x", "channel": "x", "value": "BASE_NODE_ID.x" },
      // { "name": "y", "channel": "y", "value": "BASE_NODE_ID.y" },
      // { "name": "color", "channel": "color", "value": "BASE_NODE_ID.color" },
      // { "name": "size", "channel": "size", "value": "BASE_NODE_ID.size" },
      // { "name": "opacity", "channel": "opacity", "value": "BASE_NODE_ID.opacity" }
    ]
  }
]

export class BaseChart extends BaseComponent {
  protected spec: ChartSpec;
  protected width: number;
  protected height: number;
  protected padding: number;
  public x: any; // this should become an anchorProxy I think 
  public y: any;
  public color: any;
  public size: any;
  public shape: any;
  public opacity: any;
  public isChart = true;
  // public isChart: boolean;

  public channelConfigs: SplitConfig;

  constructor(config: ChartConfig) {
    // this.isChart = true;
    super({ ...config }, configurations, true);
    this.width = config.width || 400;
    this.height = config.height || 300;
    this.padding = config.padding || 20;
   

    this.spec = {
      name: this.id,
      title: config.title,
      data: { values: config.data, name: 'baseChartData' },
      mark: config.mark,
      //@ts-ignore
      width: this.width,
      height: this.height,
      encoding: {}
    };

    const channelConfigs = this.splitChannelConfig(config);
    this.channelConfigs = channelConfigs;
    this.initializeAnchors();

  }

  private splitChannelConfig(config: ChartConfig): SplitConfig {
    const result: SplitConfig = {
      encodingBinds: {},
      encodingDefs: {}
    };

    // Process each channel (x, y, color, size, opacity)
    ['x', 'y', 'color', 'size', 'opacity'].forEach(channel => {
      const value = config[channel as keyof ChartConfig];
      if (!value) return;

      if (Array.isArray(value)) {
        // Handle arrays of values
        value.forEach(v => this.categorizeValue(v, channel, result));
      } else {
        this.categorizeValue(value, channel, result);
      }
    });

    return result;
  }

  private categorizeValue(
    value: FieldProps | FieldValue,
    channel: string,
    result: SplitConfig
  ) {
    if (typeof value === 'string') {
      // It's a FieldName
      // if its a field Name we need to check what the datatype of the field is 

      // if its a field Name we need to check what the datatype of the field is this.spec.data[0][value]
      //@ts-ignore as data will always be read in already in notebook so far....
      const fieldType = typeof this.spec.data.values[0][value] || "undefined";
      if (fieldType === 'number') {
        // NOTE: this will not be true if the field is a bind TODO: fix this 
        result.encodingDefs[channel] = { field: value, type: 'quantitative' };
      } else if (fieldType === 'string') {
        result.encodingDefs[channel] = { field: value, type: 'ordinal' };
      } else {
        result.encodingDefs[channel] = { field: value, type: 'nominal' };
      }
    } else if (typeof value === 'object' && value !== null && 'bind' in value) {
      // It's an AnchorProxy
      result.encodingBinds[channel] = value;
    } else {
      // It's a ValueDef
      result.encodingDefs[channel] = { value: value };
    }
  }

  initializeAnchors() {
    if (!this.spec.encoding) {
      throw new Error('Encoding is required for a chart');
    }

    this.configurations.forEach(config => {
            // this.configurations[config.id] = config
            const schema = config.schema
            for (const key in schema) {
                const schemaValue = schema[key];
                const keyName = config.id + '_' + key
                this.schema[keyName] = schemaValue;


                this.anchors.set(keyName, this.createAnchorProxy({ [keyName]: schemaValue }, keyName, () => {
                  console.log('generateConfigurationAnchors outside2', this.id, config.id, key, schemaValue)  
                  const generatedAnchor = generateConfigurationAnchors(this.id, config.id, key, schemaValue)

                    console.log('generatedAnchorchart', key, config.id,schemaValue,generatedAnchor);
                    return generatedAnchor
                }));
            }

        }); 
    // const anchors: { id: string, proxy: AnchorProxy }[] = [];

    // Object.entries(this.spec.encoding).forEach(([key, encoding]) => {
    //   let scaleName = key;

    //   // fields like x1, x2 should go to x
    //   if (isPositionChannel(key)) {
    //     const positionChannel = getMainRangeChannel(key as PositionChannel);
    //     scaleName = positionChannel; // used for any reference and inversions 
    //   }


    //   const encodingProxy = Object.entries(this.spec.encoding).reduce((acc, [key]) => {
    //     if (key === scaleName) {
    //       acc[key] = RangeSchema;
    //     } else {
    //       // acc[key] = NumericScalar;
    //     }
    //     return acc;
    //   }, {} as Record<string, SchemaType>);





    //   // Scalar
    //   const compiledAnchor = Object.entries(this.spec.encoding).reduce((acc, [key]) => {
    //     if (key === scaleName) {
    //       // some encoding channels like y have an inverted range, so we must min/max the range
    //       acc[key] = {
    //         'start': `${this.id}_start_${key}`,
    //         'stop': `${this.id}_stop_${key}`,
    //       };
    //     } else { // this is scalar, numeric
    //       // acc[key] = {
    //       //   'value': `range('${this.id+'_'+scaleName}')[0]`, // min value
    //       // };
    //     }
    //     return acc;
    //   }, {} as Record<string, SchemaValue>);





    //   // currently this returns anchors compile with {x,y,etc}.. I think this is actually supposed tobe something like schema constraints, and then we grab 
    //   // them lat
    //   anchors.push({
    //     'id': scaleName, 'proxy': this.createAnchorProxy(encodingProxy, scaleName, () => {
    //       return compiledAnchor[scaleName]
    //     })
    //   })
    // })

    // // compile bindFn

    // // for each anchor, add it
    // anchors.forEach((anchor) => {
    //   this.anchors.set(anchor.id, anchor.proxy);
    // })
    super.initializeAnchors();

  }

  initializeChartAnchors() {


    // encoding anchor types: 
    // position (define the range of values for a channel)

  }



  compileComponent(value: any): Partial<UnitSpec<Field>> {
    // add params to the spec for range access (TODO, find out why accessing range directly is erroring)
    this.spec.params = [
      //@ts-ignore
      { "name": this.id + "_plot_start_x", "expr": "range('x')[0]" },
      //@ts-ignore
      { "name": this.id + "_plot_stop_x", "expr": "range('x')[1]" },
      //@ts-ignore, note : y range is inverted due to svg layout
      { "name": this.id + "_plot_start_y", "expr": "range('y')[1]" },
      //@ts-ignore
      { "name": this.id + "_plot_stop_y", "expr": "range('y')[0]" },
      //@ts-ignore
      { "name": this.id + "_x_start_x", "expr": "range('x')[0]" },
      //@ts-ignore
      { "name": this.id + "_x_stop_x", "expr": "range('x')[1]" },
      //@ts-ignore
      { "name": this.id + "_x_start_y", "expr": "range('y')[1]" },
      //@ts-ignore
      { "name": this.id + "_x_stop_y", "expr": "range('y')[0]" },
    ]




    return this.spec;
  }



  protected mergeSpecs(baseSpec: ChartSpec, newSpec: Partial<ChartSpec>): ChartSpec {
    return {
      ...baseSpec,
      ...newSpec,
      encoding: {
        ...baseSpec.encoding,
        ...newSpec.encoding
      }
    };
  }


}

function isPositionChannel(channel: string): boolean {
  return ['x', 'y', 'x2', 'y2'].includes(channel);
}


// for each anchor type, this is what the data represents (ie x,y,) generally the channel
// but that within that, there can be different types of data (ie x can be a range or a value)
// so we'll need to define ways to compute between these. 
// fieldValue, fieldRange
// but then there are also more complex things like scales, which should also add clamps
// so like fieldRange, when compiled to a value should give average 
// but when fieldRange is compiled to a range, it should give the min and max of all of the data  

