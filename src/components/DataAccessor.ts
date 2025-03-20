import { BaseComponent } from "./base";
import { UnitSpec } from "vega-lite/build/src/spec";
import { Field } from "vega-lite/build/src/channeldef";

type DataOperation = {
  type: 'filter' | 'aggregate' | 'groupby' | 'count' | 'percent';
  params: any;
};

// Create a component class for data transformation
class DataTransformer extends BaseComponent {
  private operations: DataOperation[] = [];
  private sourceSelectionName: string;
  
  constructor(sourceComponent: BaseComponent, operations: DataOperation[]) {
    super({});
    this.sourceSelectionName = sourceComponent.id;
    this.operations = [...operations]; // Clone the operations
    
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

    this.anchors.set('data', this.createAnchorProxy({ 
        'data': { 
          container: 'Data',
          valueType: 'Data',
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
    // Add data transforms to the chart
    const transforms = this.compileToTransforms();
    
    return {
      transform: transforms
    };
  }
  
  // Method to compile into VL transforms
  private compileToTransforms(): any[] {
    const transforms = [];
    
    // Start with the selection filter
    transforms.push({
      filter: { selection: this.sourceSelectionName }
    });
    
    // Process operations
    let needsAggregate = false;
    let aggregateOps = [];
    let groupbyFields = [];
    
    for (const op of this.operations) {
      switch (op.type) {
        case 'filter':
          transforms.push({ filter: op.params.expr });
          break;
        case 'groupby':
          groupbyFields = op.params.fields;
          needsAggregate = true;
          break;
        case 'count':
          aggregateOps.push({ op: 'count', as: 'count' });
          needsAggregate = true;
          break;
        case 'percent':
          // This needs to be added after aggregation
          const parentCount = "data('baseChartData').length" // TODO not hardcoded
          aggregateOps.push({ op: 'count', as: 'count' });
          transforms.push({
            calculate: `datum.count / ${parentCount}`, 
            as: "percent"
          });
          break;
      }
    }
    
    // Add aggregate transform if needed
    if (needsAggregate) {
      transforms.push({
        aggregate: aggregateOps,
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
  
  // Convert to a component at the end of chaining
  toComponent(): BaseComponent {
    console.log('toComponent', this.sourceComponent, this.operations)
    return new DataTransformer(this.sourceComponent, this.operations);
  }

  get value(): BaseComponent {
    console.log('value', this.toComponent())
    return this.toComponent();
  }
  
  // Implicit conversion when used as a value
  valueOf(): BaseComponent {
    console.log('valueOf', this.toComponent())
    return this.toComponent();
  }
  
  // Support for toString() conversion
  toString(): string {
    return `DataAccessor(${this.sourceComponent.id}, operations: ${this.operations.length})`;
  }
}