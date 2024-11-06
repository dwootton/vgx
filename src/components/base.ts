import { Anchor, AnchorOrGroup, AnchorProxy } from '../types/anchors';
import { BindingGraph } from '../utils/bindingGraph';
import { generateId } from '../utils/id';

export interface Component {
  id: string;
  type: string;
  anchors: Map<string, AnchorOrGroup>;
  getSpec(): any;
}


export abstract class BaseComponent {
  id: string;
  private rawAnchors: Map<string, AnchorOrGroup> = new Map();
  protected anchors: Map<string, AnchorProxy> = new Map();

  protected bindingGraph: BindingGraph;

  constructor() {
    this.id = `component_${Date.now()}_${Math.random()}`;
    this.bindingGraph = new BindingGraph();
  }
  // Generate scoped anchor IDs
  public generateAnchorId(name: string): string {
    return `${this.id}:${name}`; // e.g., "brush_123:topLeft"
  }


  // protected createAnchorProxy(anchorId: string): BindFunction {
  //   // const bindFn = (target: BaseComponent | { component: BaseComponent, anchorId: string }) => {
  //   //   // If target is an anchor proxy (e.g., brush.x), it will have component and anchorId
  //   //   console.log('target:', target);
      
  //   //   const targetComponent = 'component' in target ? target.component : target;
  //   //   const targetAnchorId = 'anchorId' in target ? target.anchorId : anchorId;

  //   //   this.bindingGraph.addComponent(this.id, this.anchors);
  //   //   this.bindingGraph.addComponent(targetComponent.id, targetComponent.anchors);

  //   //   const bindingId = this.bindingGraph.addBinding(
  //   //     this.id,
  //   //     anchorId,
  //   //     targetComponent.id,
  //   //     targetAnchorId
  //   //   );

  //   //   return targetComponent;
  //   // };
  //   // Create the bind function
    
  //   const bindFn = (target: any) => {
  //     const targetComponent = target?.component || target;
  //     const targetAnchorId = target?.anchorId;

  //     if (!targetComponent || !targetAnchorId) {
  //       console.warn('Invalid binding target:', target);
  //       return this;
  //     }

  //     this.bindingGraph.addComponent(this.id, this.anchors);
  //     this.bindingGraph.addComponent(targetComponent.id, targetComponent.anchors);

  //     const bindingId = this.bindingGraph.addBinding(
  //       this.id,
  //       anchorId,
  //       targetComponent.id,
  //       targetAnchorId
  //     );

  //     return targetComponent;
  //   };
  //   // Create proxy object with metadata
  //   const proxyObj = {
  //     component: this,
  //     anchorId: anchorId,
  //     bind: bindFn,
  //     // Add other anchor properties
  //     ...this.anchors.get(anchorId)
  //   };

  //   // Return proxy that handles both function calls and property access
  //   return new Proxy(proxyObj, {
  //     get: (target, prop) => {
  //       if (prop === 'bind') {
  //         return (targetProxy: any): BaseComponent => {
  //           return proxyObj.bind(targetProxy, targetProxy.anchorId);
  //         };
  //       }
  //       return target[prop as keyof typeof target];
  //     },
  //     apply: (target, thisArg, args) => {
  //       return target.bind.apply(thisArg, args as [BaseComponent, string]);
  //     }
  //   });
    

  // }
  protected createAnchorProxy(anchor: AnchorOrGroup): AnchorProxy {
    // Create the bind function
    const bindFn = (targetAnchor: AnchorProxy) => {
      if (!targetAnchor?.component || !targetAnchor?.id) {
        throw new Error('Invalid binding target');
      }

      this.bindingGraph.addBinding(
        this.id,
        anchor.id,
        targetAnchor.component.id, //component ID
        targetAnchor.id //anchor ID
      );

      return targetAnchor.component;
    };

    const bindFninOgproxy = (targetAnchor: any) => {
      console.log('in og proxy bind')
      return targetAnchor.component;
    };

    const proxyObj = {
          id: anchor.id,
          component: this,
          bind: bindFninOgproxy,
          // Add other anchor properties
        };

      
    // Return proxy that handles both function access and property access
    return new Proxy(proxyObj, {
      get: (source, prop) => {
        if (prop === 'bind') {
          // actually call the bind function
          console.log('bind called from:', source);
          return (target: AnchorProxy)=>bindFn(target);
        }
        if (prop === 'component') return this;
        
        // Get raw anchor data for other property access

        return anchor?.[prop as keyof AnchorOrGroup];
      }
    });
  }

  protected getRawAnchor(anchorId: string): AnchorOrGroup | undefined {
    return this.rawAnchors.get(anchorId);
  }

  protected setRawAnchor(anchorId: string, anchor: AnchorOrGroup) {
    this.rawAnchors.set(anchorId, anchor);
    // Create/update proxy when setting raw anchor
    this.createAnchorProxy(anchor);
  }

  // Example usage of getting bindings for a component
  getBindings() {
    return {
      all: this.bindingGraph.getBindings(this.id),
      asSource: this.bindingGraph.getSourceBindings(this.id),
      asTarget: this.bindingGraph.getTargetBindings(this.id)
    };
  }
}