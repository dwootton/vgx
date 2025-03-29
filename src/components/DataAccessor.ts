import { BaseComponent } from "./base";
import { UnitSpec } from "vega-lite/build/src/spec";
import { Field } from "vega-lite/build/src/channeldef";
import { generateConfigurationAnchors } from "./interactions/Drag";
import { LazyOperation } from "../binding/LazyBinding";
import { CompilationContext } from "../binding/binding";

type DataOperation = {
  type: 'filter' | 'aggregate' | 'groupby' | 'count' | 'percent';
  params: any;
};

// TODO: figure out why data is not being passed as an anchor (or if it is.. )
const configurations = [{
    'id': 'transform',
    "default": true,
    "schema": {
       
        "data": { 
            container: 'Absolute',
            valueType: "Data"
          },
          "text": { 
            container: 'Absolute',
            valueType: "Categorical"
          }
       
    },
    "transforms": [
        { "name": "x", "channel": "x", "value": "BASE_NODE_ID.x" },
        { "name": "y", "channel": "y", "value": "BASE_NODE_ID.y" },
        // { "name": "text", "channel": "text", "value": "BASE_NODE_ID.text" }
    ]
}];
// Create a component class for data transformation
class DataTransformer extends BaseComponent {
  private accessor: DataAccessor;
  private sourceSelectionName: string;
  
  constructor(sourceComponent: BaseComponent, accessor: DataAccessor) {
    super({},configurations);
    this.sourceSelectionName = sourceComponent.id;
    this.accessor = accessor
    
    // this.configurations = configurations;

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
        // this.anchors.set(config.id, this.createAnchorProxy({[config.id]: config.schema[config.id]}, config.id, () => {
        //     return generateConfigurationAnchors(this.id, config.id)
        // }));
    });
  }
  
  
  compileComponent(inputContext: CompilationContext): Partial<UnitSpec<Field>> {
    // Add data transforms to the chart
    console.log('data transformer compilation inputContext', inputContext)
    const transforms = this.compileToTransforms();
    
    const compilation = {
      "data":{
        name: "VGXMOD_"+this.id +"_transform_data",
        transform: transforms,
        source: "baseChartData"
      },
      "params": [
        //@ts-ignore
        {
          "name":this.id +"_transform_text",
          "value":"count", // the name of the field to read data from
        }
      ]
    };

    console.log('data transformer compilation', compilation)

    return compilation;
  }
  
  // Method to compile into VL transforms
  private compileToTransforms(): any[] {
    const transforms = [];
    
    // Start with the selection filter
    transforms.push({
      type: "filter",
      expr: `vlSelectionTest("${(this.sourceSelectionName)}_selection_store", datum)`
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


  // Used to apply operations to data transforms if referenced before initialization
   public applyOperations(accessor: any, operations: LazyOperation[]){
    let value = accessor;
    for (const op of operations) {
        if (value && value[op.type]) {
            value = value[op.type](...op.args);
        }
    }
    return value;
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