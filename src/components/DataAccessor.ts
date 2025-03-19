import { BaseComponent } from "../components/base";

type DataOperation = {
  type: 'filter' | 'aggregate' | 'groupby' | 'count' | 'percent';
  params: any;
};

export class DataAccessor {
  private sourceComponent: BaseComponent;
  private operations: DataOperation[] = [];
  private selectionName: string;
  
  constructor(sourceComponent: BaseComponent, selectionName?: string) {
    this.sourceComponent = sourceComponent;
    this.selectionName = selectionName || sourceComponent.id;
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

  // Method to get a reference to this data
  getReference(): string {
    return `${this.selectionName}_data`;
  }

  // Method to compile into VL transforms
  compileToTransforms(): any[] {
    const transforms = [];
    
    // Start with the selection filter
    transforms.push({
      filter: { selection: this.selectionName }
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
          aggregateOps.push({ op: 'count', as: op.params.as });
          needsAggregate = true;
          break;
        case 'percent':
          // This needs to be added after aggregation
          transforms.push({
            calculate: "datum.count / parent.count", 
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