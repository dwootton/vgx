import { AnchorSchema, AnchorId,AnchorOrGroupSchema, AnchorProxy } from '../types/anchors';
import { BindingGraph } from '../utils/bindingGraph';
import { BindingStore, ContextManager } from '../utils/bindingStore';
import { generateAnchorId, generateId } from '../utils/id';
import {  CompilationContext, CompilationResult, ParentInfo } from '../types/compilation';
import { Field } from 'vega-lite/build/src/channeldef';
import { LayerSpec, UnitSpec} from 'vega-lite/build/src/spec';

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
    this.id = generateId(); // generate hex id
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
      const parentBinding = graph.getBindingsAsChild(currentId)[0];
      if (!parentBinding) break;
      currentId = parentBinding.parentAnchorId.componentId;
    }

    const component = this.bindingStore.getComponent(currentId);
    return component;
  }
  // This is the method components implement
  abstract compileComponent(
    context: CompilationContext,
  ): Partial<UnitSpec<Field>>;

  // Public compile that redirects to root chart
  compile(): any {
    // Get the binding graph this component belongs to

    // Walk up bindings to find the root chart component
    const rootChart = this.findRootChart();
    if (!rootChart) {
      throw new Error('No root chart found for component');
    }


    // Call compile on the root chart
    return rootChart.compiler.compileRootComponent(rootChart);
  }

  // drag.bind(point), will now go through and bind drag.x to point.x, drag.y to point.y, etc.
  bind(target: AnchorProxy | BaseComponent) {
    console.log('base binding', this, target);

    // if this component is being based bound, you should go through and bind all of the properties to the target component
    if (target instanceof BaseComponent) {
      // Get all properties of the target component
      const targetProps = Object.getOwnPropertyNames(Object.getPrototypeOf(target));
      
      // For each anchor in this component
      this.anchors.forEach((anchor, key) => {
        if (!anchor) return;
        
        // Check if there's a matching property name in the target
        if (targetProps.includes(key)) {
          // Get the corresponding anchor from target
          const targetAnchor = target.anchors.get(key);
          if (targetAnchor) {
            anchor.bind(targetAnchor);
          }
        }
      });
    }
  }




  protected createAnchorProxy(anchor: AnchorOrGroupSchema): AnchorProxy {
    const anchorId: AnchorId =  {
      componentId: this.id,
      anchorId: anchor.id
    };
    
    const bindFn = (childAnchor: AnchorProxy) => {
      console.log('parent',anchor, 'child',childAnchor);
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
      anchorRef: anchor,
      value: createValueProxy(anchorId, this.bindingStore)
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


interface AnchorQueryConfig {
  anchorId: AnchorId;
  bindingStore: BindingStore;
}

class AnchorQuery {
  constructor(
    public anchorId: AnchorId,
    public bindingStore: BindingStore,
    public path: string[] = []
  ) {}

  resolve() {
    // Your existing resolve logic
  }
}

// Create a proxy handler that tracks property access
function createValueProxy(anchorId: AnchorId, bindingStore: BindingStore, path: string[] = []): any {
  const MAX_PATH_LENGTH = 5;

  const handler = {
    get(target: AnchorQuery, prop: string) {
      console.log('AnchorQuery get', prop, path);
      
      // Handle special properties
      if (prop === 'resolve' || prop === 'then') {
        return target[prop].bind(target);
      }

      // Check if we've reached the maximum path length
      if (path.length >= MAX_PATH_LENGTH) {
        console.warn(`Maximum path length (${MAX_PATH_LENGTH}) exceeded. Returning null.`);
        return null;
      }

      // Create new path
      return createValueProxy(anchorId, bindingStore, [...path, prop]);
    }
  };

  return new Proxy(new AnchorQuery(anchorId, bindingStore, path), handler);
}


// Then simplify the removeProxies function to focus on handling objects
export const removeProxies = (obj: any): any => {
    // Handle null/undefined
    if (obj == null) return obj;

    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map(item => removeProxies(item));
    }

    // Handle non-object types
    if (typeof obj !== 'object') return obj;

    // Check if it's our AnchorQuery
    if (obj instanceof AnchorQuery) {
        try {
            return obj.resolve();
        } catch {
            return null;
        }
    }

    // Create a new object to avoid modifying the original
    const cleanObj: any = {};

    for (const key in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        
        try {
            const value = obj[key];
            if (value instanceof AnchorQuery) {
                try {
                    cleanObj[key] = value.resolve();
                } catch {
                    continue;
                }
            } else if (value && typeof value === 'object') {
                cleanObj[key] = removeProxies(value);
            } else {
                cleanObj[key] = value;
            }
        } catch {
            // If accessing the property throws, skip it
            continue;
        }
    }

    return cleanObj;
};