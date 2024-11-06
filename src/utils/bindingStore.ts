import { BaseComponent } from '../components';
import { BindingGraph } from './bindingGraph';

// Singleton store to manage all binding graphs
export class BindingStore {
    private static instance: BindingStore;
    private defaultGraph: BindingGraph;
    private graphs: Map<string, BindingGraph> = new Map();
    private componentToGraphMap: Map<string, string> = new Map();
  
    private constructor() {
      this.defaultGraph = new BindingGraph();
      this.graphs.set('default', this.defaultGraph);
    }
  
    static getInstance(): BindingStore {
      if (!BindingStore.instance) {
        BindingStore.instance = new BindingStore();
      }
      return BindingStore.instance;
    }
  
    createGraph(graphId: string): BindingGraph {
      const graph = new BindingGraph();
      this.graphs.set(graphId, graph);
      return graph;
    }
  
    getGraph(graphId: string): BindingGraph {
      return this.graphs.get(graphId) || this.defaultGraph;
    }
  
    getDefaultGraph(): BindingGraph {
      return this.defaultGraph;
    }
  
    registerComponent(componentId: string, graphId: string = 'default') {
      this.componentToGraphMap.set(componentId, graphId);
    }
  
    getGraphForComponent(componentId: string): BindingGraph {
      const graphId = this.componentToGraphMap.get(componentId);
      return this.graphs.get(graphId || 'default') || this.defaultGraph;
    }
  }
  
export class ContextManager {
    private static instance: ContextManager;
    private contexts: Set<string> = new Set();
    private defaultContext = 'default';
  
    private constructor() {}
  
    static getInstance(): ContextManager {
      if (!ContextManager.instance) {
        ContextManager.instance = new ContextManager();
      }
      return ContextManager.instance;
    }
  
    createContext(name?: string): string {
      const contextId = name || `context_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.contexts.add(contextId);
      return contextId;
    }
  
    getDefaultContext(): string {
      if (!this.contexts.has(this.defaultContext)) {
        this.contexts.add(this.defaultContext);
      }
      return this.defaultContext;
    }
  
    validateContext(contextId: string): boolean {
      return this.contexts.has(contextId);
    }
  
    listContexts(): string[] {
      return Array.from(this.contexts);
    }
  }
  