import { BaseComponent } from "./base";
import { UnitSpec } from "vega-lite/build/src/spec";
import { Field } from "vega-lite/build/src/channeldef";
import { generateConfigurationAnchors } from "./interactions/drag2";

type DataOperation = {
  type: 'filter' | 'aggregate' | 'groupby' | 'count' | 'percent';
  params: any;
};


const configurations = [{
    'id': 'transform',
    "default": true,
    "schema": {
       
        "data": { 
            container: 'Data',
            valueType: "Numeric"
          },
          "text": { 
            container: 'Scalar',
            valueType: "Categorical"
          }
       
    },
    "transforms": [
        { "name": "x", "channel": "x", "value": "PARENT_ID.x" },
        { "name": "y", "channel": "y", "value": "PARENT_ID.y" },
        // { "name": "text", "channel": "text", "value": "PARENT_ID.text" }
    ]
}];
// Create a component class for data transformation
class DataTransformer extends BaseComponent {
  private accessor: DataAccessor;
  private sourceSelectionName: string;
  
  constructor(sourceComponent: BaseComponent, accessor: DataAccessor) {
    super({});
    this.sourceSelectionName = sourceComponent.id;
    this.accessor = accessor
    
    // this.configurations = configurations;

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
        // this.anchors.set(config.id, this.createAnchorProxy({[config.id]: config.schema[config.id]}, config.id, () => {
        //     return generateConfigurationAnchors(this.id, config.id)
        // }));
    });



    
   
    // this.anchors.set('data', this.createAnchorProxy({ 
    //     'data': { 
    //       container: 'Data',
    //       valueType: "Numeric"
    //     }
    //   }, 'data', () => {
    //     return 

    //   }));

    //   this.anchors.set('text', this.createAnchorProxy({ 
    //     'text': { 
    //       container: 'Scalar',
    //       valueType: "Categorical"
    //     }
    //   }, 'text', () => {

    //     return "datum.count";

    //   }));

      

      console.log('dataAnchor', this.anchors.get('transform_data'))
    
    // Setup basic anchors
    // this.setupAnchors();
  }
  
  private setupAnchors() {
    // Always set up count anchor regardless of operations
    this.anchors.set('count', this.createAnchorProxy({ 
      'count': { 
        container: 'Scalar',
        valueType: 'Numeric',
      }
    }, 'count', () => {
      return { 'value': `datum.count` };
    }));

    // Always set up percent anchor
    this.anchors.set('percent', this.createAnchorProxy({ 
      'percent': { 
        container: 'Scalar',
        valueType: 'Numeric',
      }
    }, 'percent', () => {
      return { 'value': `datum.count` }; // Using count for now
    }));
    
    // // Setup anchors for each field in groupby operations
    // const groupbyOps = this.operations.filter(op => op.type === 'groupby');
    // groupbyOps.forEach(op => {
    //   op.params.fields.forEach((field: string) => {
    //     this.anchors.set(field, this.createAnchorProxy({ 
    //       [field]: { 
    //         container: 'Scalar',
    //         valueType: 'Categorical',
    //       }
    //     }, field, () => {
    //       return { 'value': `datum.count` }; // Using count for now
    //     }));
    //   });
    // });
  }
  
  compileComponent(inputContext: any): Partial<UnitSpec<Field>> {
    console.log('compiging data accessor', inputContext)
    // Add data transforms to the chart
    const transforms = this.compileToTransforms();
    
    return {
      "dataAccessor":{
        datasetName:this.id +"_transform_data",
        transform: transforms,
        source: "baseChartData"
      }
    };
  }
  
  // Method to compile into VL transforms
  private compileToTransforms(): any[] {
    const transforms = [];
    
    // Start with the selection filter
    transforms.push({
      type: "filter",
      expr: `vlSelectionTest("${(this.sourceSelectionName)}_store", datum)`
    });
    
    // Process operations
    let needsAggregate = false;
    let aggregateFields = [];
    let aggregateOps = [];
    let aggregateAs = [];
    let groupbyFields = [];

    const operations = this.accessor.operations;
    
    for (const op of operations) {
      switch (op.type) {
        case 'filter':
        //   transforms.push({ 
        //     type: "filter", 
        //     expr: op.params.expr 
        //   });
          break;
        case 'groupby':
          groupbyFields = op.params.fields;
          needsAggregate = true;
          break;
        case 'count':
          aggregateFields.push(null);
          aggregateOps.push('count');
          aggregateAs.push('count');
          needsAggregate = true;
          break;
        case 'percent':
          // This needs to be added after aggregation
          const parentCount = "data('baseChartData').length"; // TODO not hardcoded
          // Make sure count is included in aggregation
          if (!aggregateOps.includes('count')) {
            aggregateFields.push(null);
            aggregateOps.push('count');
            aggregateAs.push('count');
            needsAggregate = true;
          }
          transforms.push({
            type: "formula",
            expr: `datum.count / ${parentCount}`,
            as: "percent"
          });
          break;
      }
    }
    console.log('transformsCompiled', transforms)
    
    // Add aggregate transform if needed
    if (needsAggregate) {
      transforms.push({
        type: "aggregate",
        fields: aggregateFields,
        ops: aggregateOps,
        as: aggregateAs,
        ...(groupbyFields.length > 0 && { groupby: groupbyFields })
      });
    }
    
    return transforms;
  }
}


export class DataAccessor {
  private sourceComponent: BaseComponent;
  private operations: DataOperation[] = [];
  
  constructor(sourceComponent: BaseComponent) {
    this.sourceComponent = sourceComponent;
    

  }
  // Basic operations
  filter(expr: string): DataAccessor {
    this.operations.push({ type: 'filter', params: { expr } });
    return this;
  }

  groupby(...fields: string[]): DataAccessor {
    this.operations.push({ type: 'groupby', params: { fields } });
    return this;
  }

  // Aggregation method
  count(): DataAccessor {
    console.log('PUSHING COUNT', this.sourceComponent.id)
    this.operations.push({ 
      type: 'count', 
      params: { as: 'count' } 
    });
    return this;
  }

  // Getter for percentage of total data
  get percent(): DataAccessor {
    this.operations.push({
      type: 'percent',
      params: { as: 'percent' }
    });
    return this;
  }
  
  // Convert to a component at the end of chaining
  toComponent(): BaseComponent {
    return new DataTransformer(this.sourceComponent, this);
  }

  get value(): BaseComponent {
    return this.toComponent();
  }
  
  // Implicit conversion when used as a value
  valueOf(): BaseComponent {
    return this.toComponent();
  }
  
  // Support for toString() conversion
  toString(): string {
    return `DataAccessor(${this.sourceComponent.id}, operations: ${this.operations.length})`;
  }
}