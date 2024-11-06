// src/core.ts
// @ts-nocheck
import { TopLevelSpec } from 'vega-lite';
import { Spec as VegaSpec } from 'vega';
// src/core.ts
// @ts-nocheck
import { TopLevelSpec } from 'vega-lite';

export type ChartType = 'point' | 'bar' | 'line' | 'rect';
export type DataType = 'quantitative' | 'nominal' | 'ordinal' | 'temporal';

export interface Encoding {
  field: string;
  type: DataType;
  bin?: boolean | { step: number };
  aggregate?: 'count' | 'sum' | 'mean' | 'median';
  timeUnit?: string;
  title?: string;
}


// Binding graph nodes
export interface BindingNode {
  id: string;
  type: 'spatial' | 'encoding' | 'event' | 'transform';
  parentId?: string;
  children: string[];  // IDs of child nodes
  value: any;  // The actual anchor object
  bindingType?: string;  // e.g., 'brush', 'drag_point', etc.
}

export interface BindingGraph {
  nodes: Map<string, BindingNode>;
  getNode(id: string): BindingNode | undefined;
  addNode(node: BindingNode): void;
  addBinding(parentId: string, childId: string): void;
  getBindings(nodeId: string): BindingNode[];
  getRootBindings(): BindingNode[];
}

// Implementation of the binding graph
class BasicBindingGraph implements BindingGraph {
  nodes: Map<string, BindingNode> = new Map();

  getNode(id: string) {
    return this.nodes.get(id);
  }

  addNode(node: BindingNode) {
    this.nodes.set(node.id, node);
  }

  addBinding(parentId: string, childId: string) {
    const parent = this.nodes.get(parentId);
    const child = this.nodes.get(childId);
    
    if (parent && child) {
      parent.children.push(childId);
      child.parentId = parentId;
    }
  }

  getBindings(nodeId: string): BindingNode[] {
    const node = this.nodes.get(nodeId);
    if (!node) return [];

    const bindings: BindingNode[] = [];
    const queue = [node];

    while (queue.length > 0) {
      const current = queue.shift()!;
      bindings.push(current);
      
      for (const childId of current.children) {
        const child = this.nodes.get(childId);
        if (child) queue.push(child);
      }
    }

    return bindings;
  }

  getRootBindings(): BindingNode[] {
    return Array.from(this.nodes.values())
      .filter(node => !node.parentId);
  }
}


// Base Chart with spatial anchors
export class BaseChart {
  protected spec: TopLevelSpec;
  protected spatialAnchors: Map<string, SpatialAnchor>;
  protected bindingGraph: BindingGraph;
  protected nextId: number = 0;

  constructor(config: any) {
    // ... previous initialization ...
    this.bindingGraph = new BasicBindingGraph();
    this.initializeBindingNodes();
  }

  protected generateId(): string {
    return `node_${this.nextId++}`;
  }

  protected initializeBindingNodes() {
    // Initialize nodes for each encoding
    Object.entries(this.spec.encoding).forEach(([channel, encoding]) => {
      const nodeId = this.generateId();
      this.bindingGraph.addNode({
        id: nodeId,
        type: 'encoding',
        children: [],
        value: encoding
      });
    });

    // Initialize nodes for spatial anchors
    this.spatialAnchors.forEach((anchor, name) => {
      const nodeId = this.generateId();
      this.bindingGraph.addNode({
        id: nodeId,
        type: 'spatial',
        children: [],
        value: anchor
      });
    });
  }

  protected createBindingProxy(property: string, type: 'spatial' | 'encoding' | 'event' | 'transform') {
    return new Proxy({}, {
      get: (target, prop) => {
        if (prop === 'bind') {
          return (value: any) => {
            // Create new node for the bound value
            const newNodeId = this.generateId();
            this.bindingGraph.addNode({
              id: newNodeId,
              type: type,
              children: [],
              value: value,
              bindingType: value.type // e.g., 'brush', 'drag_point'
            });

            // Find the parent node (the one being bound to)
            const parentNode = Array.from(this.bindingGraph.nodes.values())
              .find(node => node.value === target);

            if (parentNode) {
              this.bindingGraph.addBinding(parentNode.id, newNodeId);
            }

            // Return proxy for the new node for further chaining
            return this.createBindingProxy(newNodeId, type);
          };
        }

        // Handle other property access
        const node = this.bindingGraph.getNode(property);
        if (node) {
          return node.value[prop];
        }
      }
    });
  }

  // Method to inspect bindings
  getBindings() {
    return {
      all: Array.from(this.bindingGraph.nodes.values()),
      roots: this.bindingGraph.getRootBindings()
    };
  }

  // Example usage in compilation
  async compile() {
    // Get all bindings and their relationships
    const bindings = this.getBindings();
    
    // Process bindings to modify spec
    bindings.roots.forEach(root => {
      const allRelatedBindings = this.bindingGraph.getBindings(root.id);
      // Use the bindings to modify the spec...
    });

    return {
      vegaLiteSpec: this.spec,
      bindingGraph: this.bindingGraph
    };
  }
}

// Chart implementations
export class Scatterplot extends BaseChart {
  constructor(config: { 
    data: any[];
    xField: string;
    yField: string;
    width?: number;
    height?: number;
  }) {
    super(config);
    this.spec.mark = 'point';
    this.spec.encoding = {
      x: { field: config.xField, type: 'quantitative' },
      y: { field: config.yField, type: 'quantitative' }
    };
  }
}

export class Histogram extends BaseChart {
  constructor(config: { 
    data: any[];
    field: string;
    binStep?: number;
    width?: number;
    height?: number;
  }) {
    super(config);
    this.spec.mark = 'bar';
    this.spec.encoding = {
      x: {
        field: config.field,
        type: 'quantitative',
        bin: { step: config.binStep || 10 },
      },
      y: {
        aggregate: 'count',
        type: 'quantitative'
      }
    };
  }
}

export class LinePlot extends BaseChart {
  constructor(config: { 
    data: any[];
    xField: string;
    yField: string;
    width?: number;
    height?: number;
  }) {
    super(config);
    this.spec.mark = 'line';
    this.spec.encoding = {
      x: { field: config.xField, type: 'quantitative' },
      y: { field: config.yField, type: 'quantitative' }
    };
  }
}

export class BarChart extends BaseChart {
  constructor(config: { 
    data: any[];
    xField: string;
    yField: string;
    xType?: DataType;
    aggregate?: 'count' | 'sum' | 'mean';
    width?: number;
    height?: number;
  }) {
    super(config);
    this.spec.mark = 'bar';
    this.spec.encoding = {
      x: { 
        field: config.xField, 
        type: config.xType || 'nominal'
      },
      y: { 
        field: config.yField,
        type: 'quantitative',
        aggregate: config.aggregate || 'mean'
      }
    };
  }
}

export class Heatmap extends BaseChart {
  constructor(config: { 
    data: any[];
    xField: string;
    yField: string;
    colorField: string;
    aggregate?: 'count' | 'sum' | 'mean';
    width?: number;
    height?: number;
  }) {
    super(config);
    this.spec.mark = 'rect';
    this.spec.encoding = {
      x: { field: config.xField, type: 'nominal' },
      y: { field: config.yField, type: 'nominal' },
      color: {
        field: config.colorField,
        type: 'quantitative',
        aggregate: config.aggregate || 'mean',
        scale: { scheme: 'blues' }
      }
    };
  }
}

export class MarkRegistry {
  private static instance: MarkRegistry;
  private marks: Map<string, typeof BaseComponent> = new Map();

  static getInstance() {
    if (!MarkRegistry.instance) {
      MarkRegistry.instance = new MarkRegistry();
    }
    return MarkRegistry.instance;
  }

  register(type: string, markClass: typeof BaseComponent) {
    this.marks.set(type, markClass);
  }

  create(type: string, config: any): BaseComponent {
    const MarkClass = this.marks.get(type);
    if (!MarkClass) throw new Error(`Unknown mark type: ${type}`);
    return new MarkClass(config);
  }
}
// Export factory functions
export const alx = {
  scatterplot: (config: any) => new Scatterplot(config),
  histogram: (config: any) => new Histogram(config),
  lineplot: (config: any) => new LinePlot(config),
  barchart: (config: any) => new BarChart(config),
  heatmap: (config: any) => new Heatmap(config)
};

(window as any).alx = alx;


// Brush interactor implementation
export class Brush implements Interactor {
  type = 'brush';
  config = {};

  getSpec(state: ChartState): Partial<TopLevelSpec> {
    return {
      params: [{
        name: "brush",
        select: {
          type: "interval",
          encodings: ["x", "y"]
        }
      }]
    };
  }
}