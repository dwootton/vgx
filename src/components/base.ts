import { Anchor, AnchorOrGroup, AnchorProxy } from '../types/anchors';
import { BindingGraph } from '../utils/bindingGraph';
import { BindingStore, ContextManager } from '../utils/bindingStore';
import { generateId } from '../utils/id';
import { CompilationContext, CompilationResult, ParentInfo } from '../types/compilation';

export interface Component {
  id: string;
  type: string;
  anchors: Map<string, AnchorOrGroup>;
  getSpec(): any;
}

export abstract class BaseComponent {
  id: string;
  public anchors: Map<string, AnchorProxy> = new Map();
  private bindingStore: BindingStore;
  private graphId: string;

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
  
  abstract compile(
    context: CompilationContext, 
    parentInfo?: ParentInfo
  ): CompilationResult;

  protected createAnchorProxy(anchor: AnchorOrGroup): AnchorProxy {
    const bindFn = (targetAnchor: AnchorProxy) => {
      if (!targetAnchor?.component || !targetAnchor?.id) {
        throw new Error('Invalid binding target');
      }

      // Get the appropriate graph from the store
      const graph = this.bindingStore.getGraphForComponent(this.id);

      const targetType = targetAnchor.component.anchors.get(targetAnchor.id)?.type;
      graph.addBinding(
        this.id,
        anchor.id,
        anchor.type,
        targetAnchor.component.id,
        targetAnchor.id,
        targetAnchor.type
      );

      return targetAnchor.component;
    };

    const proxyObj = {
      id: anchor.id,
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
        return anchor?.[prop as keyof Anchor];
      }
    });
  }

  getBindings() {
    const graph = this.bindingStore.getGraphForComponent(this.id);
    return {
      all: graph.getBindings(this.id),
      asSource: graph.getSourceBindings(this.id),
      asTarget: graph.getTargetBindings(this.id)
    };
  }
}

