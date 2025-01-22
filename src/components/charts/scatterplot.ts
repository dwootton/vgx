import { AnchorProxy } from 'types/anchors';
import { BaseChart,ChartConfig, PositionEncodingDef } from './base';



const ScatterplotConfig = {
  "x":null,
  "y":null,
}

// I want to be able to access if the x should be input and output 

// chart inputs and chart outputs:


export interface ScatterplotConfig extends ChartConfig {

}

// maybe we'll have the BaseChart handle all of the splitting logic.



export class Scatterplot extends BaseChart  {

  constructor(config: ScatterplotConfig) {
    super({
      ...config,
      mark: 'point'
    });

    //  filter the config to be separated by field, value, and bindings 
   


    this.spec.encoding = {
      x: this.channelConfigs.encodingDefs.x as PositionEncodingDef,
      y: this.channelConfigs.encodingDefs.y as PositionEncodingDef,

    };

    this.initializeAnchors();

  }

  
  
} ;



