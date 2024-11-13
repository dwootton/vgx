import { AnchorSchema, AnchorId,AnchorOrGroupSchema, AnchorProxy } from '../types/anchors';
import { BindingGraph } from '../utils/bindingGraph';
import { BindingStore, ContextManager } from '../utils/bindingStore';
import { generateAnchorId, generateId } from '../utils/id';
import {  CompilationContext, CompilationResult, ParentInfo } from '../types/compilation';

export interface Component {
  id: string;
  type: string;
  anchors: Map<string, AnchorOrGroupSchema>;
  getSpec(): any;
}

export abstract class BaseComponent {
  id: string;
  public anchors: Map<string, AnchorProxy> = new Map();
  private bindingStore: BindingStore;
  private graphId: string;
  requiredProperties?: string[];

  constructor(graphId: string = 'default') {
    this.id = `component_${Date.now()}_${Math.random()}`;
    this.graphId = graphId;
    this.bindingStore = BindingStore.getInstance();
    // Register with the store
    this.bindingStore.registerComponent(this, this.graphId);
    return new Proxy(this, {
      get: (target, prop: string) => {
        // If it's a normal property/method, return it
        if (prop in target) {
          return target[prop as keyof typeof target];
        }
        // If it's an anchor name, return its proxy
        if (target.anchors.has(prop)) {
          return target.anchors.get(prop);
        }
      }
    });
  }
  // TODO fix any ->BaseChart
  private findRootChart(): any | undefined {
    // Keep walking up bindings until we find a Chart component
    const graph = this.bindingStore.getGraphForComponent(this.id);

    let currentId = this.id;
    while (true) {
      const parentBinding = graph.getTargetBindings(currentId)[0];
      if (!parentBinding) break;
      currentId = parentBinding.parentAnchorId.componentId;
    }

    const component = this.bindingStore.getComponent(currentId);
    return component;
  }
  // This is the method components implement
  abstract compileComponent(
    context: CompilationContext,
    parentInfo?: ParentInfo
  ): Partial<CompilationResult>;

  // Public compile that redirects to root chart
  compile(): CompilationResult {
    // Get the binding graph this component belongs to

    // Walk up bindings to find the root chart component
    const rootChart = this.findRootChart();
    if (!rootChart) {
      throw new Error('No root chart found for component');
    }


    // Call compile on the root chart
    return rootChart.compiler.compileRootComponent(rootChart);
  }




  protected createAnchorProxy(anchor: AnchorOrGroupSchema): AnchorProxy {
    const anchorId: AnchorId =  {
      componentId: this.id,
      anchorId: anchor.id
    };
    
    const bindFn = (childAnchor: AnchorProxy) => {
      if (!childAnchor?.component || !childAnchor?.id) {
        throw new Error('Invalid binding target');
      }


      // Get the appropriate graph from the store
      const graph = this.bindingStore.getGraphForComponent(this.id);

      graph.addBinding(
        anchorId,
        childAnchor.id
      );

      return childAnchor.component;
    };

    const proxyObj = {
      id: anchorId,
      type: anchor.type,
      component: this,
      bind: bindFn,
      anchorRef: anchor
    };

    return new Proxy(proxyObj, {
      get: (source, prop) => {
        if (prop === 'bind') {
          return (target: AnchorProxy) => bindFn(target);
        }
        if (prop === 'anchorRef') return anchor;
        if (prop === 'component') return this;
        return proxyObj?.[prop as keyof AnchorSchema];
      }
    });
  }
}


