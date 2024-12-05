import { Field } from 'vega-lite/build/src/channeldef';
import { TopLevelSpec, UnitSpec } from 'vega-lite/build/src/spec';
import { generateId } from '../utils/id';
import { AnchorValue } from 'vega';
import { AnchorGroupSchema, AnchorProxy, AnchorSchema } from '../types/anchors';
export type BindingTarget = BaseComponent | AnchorProxy;
export interface Component {
  id: string;
  type: string;
  getSpec(): any;
}

function isComponent(obj: any): obj is BaseComponent {
  return obj instanceof BaseComponent;
}



export abstract class BaseComponent {
  protected anchors: Map<string, AnchorProxy> = new Map();
  public id: string;
  
  constructor() {
    this.id = generateId();
    // Create special _all anchor that represents the entire component
    this.initializeAllAnchor();
  }

  private initializeAllAnchor() {
    const allAnchor: AnchorGroupSchema = {
      id: '_all',
      type: 'group',
      // map through all anchors and add their schemas to the children
      children: new Map(Array.from(this.anchors.entries()).map(([key, anchor]) => [key, anchor.anchorSchema]))
    };
    this.anchors.set('_all', this.createAnchorProxy(allAnchor));
  }

  // This is the top-level bind function that redirects to _all anchor
  // it is only called if bind is called on a component
  bind(target: BaseComponent | AnchorProxy): BaseComponent {
    // If target is a component, use its _all anchor
    const targetAnchor = isComponent(target) 
      ? target.getAnchor('_all')
      : target;

    // Redirect binding to our _all anchor
    return this.getAnchor('_all').bind(targetAnchor);
  }

  // Protected method to get anchor (used by bind)
  protected getAnchor(id: string): AnchorProxy {
    const anchor = this.anchors.get(id);
    if (!anchor) {
      throw new Error(`Anchor "${id}" not found`);
    }
    return anchor;
  }

  


  protected createAnchorProxy(anchor: AnchorSchema): AnchorProxy {
    // bind function that will be used if called on a specific anchor (chart.x.bind....)
    const bindFn = (target:  BindingTarget) => {
      
      // If target is a component, use its _all anchor
      const targetAnchor = isComponent(target) 
        ? target.getAnchor('_all')
        : target;

      // Get the binding graph
      const bindingManager = BindingManager.getInstance();

      // Add the binding
      bindingManager.addBinding(
        this.id,targetAnchor.id.componentId, anchor.id,
        targetAnchor.id.anchorId
      );

      //chart._all.bind(brush._all

      return targetAnchor.component;
    };

    return {
      id: { componentId: this.id, anchorId: anchor.id },
      component: this,
      bind: bindFn,
      anchorSchema: anchor
    };
  }

  abstract compileComponent(): Partial<UnitSpec<Field>>;

  compile(): TopLevelSpec {
    // find the root of the component tree
    return this.compileComponent() as TopLevelSpec;
  }
}

// Simple binding manager to track component bindings
export class BindingManager {
  private bindings: Array<{sourceId: string, targetId: string, sourceAnchor: string, targetAnchor: string}>;
  private static instance: BindingManager;

  private constructor() {
    this.bindings = [];
  }

  public static getInstance(): BindingManager {
    if (!BindingManager.instance) {
      BindingManager.instance = new BindingManager();
    }
    return BindingManager.instance;
  }

  public addBinding(sourceId: string, targetId: string, sourceAnchor: string, targetAnchor: string) {
    this.bindings.push({
      sourceId,
      targetId,
      sourceAnchor,
      targetAnchor
    });
  }

  public getBindingsForComponent(componentId: string) {
    return this.bindings.filter(binding => binding.sourceId === componentId || binding.targetId === componentId);
  }

  public getAllBindings() {
    return this.bindings;
  }
}

// Function to make properties bindable
export function anchorize<T extends object>(obj: T): T {
  const handler: ProxyHandler<T> = {
    get(target: T, prop: string | symbol): any {
      if (prop === 'bind') {
        return function(this: any, target: any) {
          // Implement binding logic here
          console.log(`Binding ${String(prop)} to`, target);
          // You might want to store this binding information somewhere
        };
      }
      
      const value = target[prop as keyof T];
      if (typeof value === 'object' && value !== null) {
        return new Proxy(value as object, handler) as any;
      }
      
      return value;
    }
  };

  return new Proxy(obj, handler);
}
