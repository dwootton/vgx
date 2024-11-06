import { Anchor, AnchorOrGroup, BindFunction } from '../types/anchors';
import { BindingGraph } from '../utils/bindingGraph';
import { generateId } from '../utils/id';

export interface Component {
  id: string;
  type: string;
  anchors: Map<string, Anchor>;
  getSpec(): any;
}


export abstract class BaseComponent {
  id: string;
  anchors: Map<string, AnchorOrGroup> = new Map();
  protected bindingGraph: BindingGraph;

  constructor() {
    this.id = `component_${Date.now()}_${Math.random()}`;
    this.bindingGraph = new BindingGraph();
  }
  // Generate scoped anchor IDs
  public generateAnchorId(name: string): string {
    return `${this.id}:${name}`; // e.g., "brush_123:topLeft"
  }

  public createGroupProxy(groupName: string): any {
    // may change for logic in the future
    return this.createAnchorProxy(groupName);
  }

  public createAnchorProxy(anchorId: string): BindFunction {
    // Create the binding function
    const bindFn: BindFunction = (targetComponent: BaseComponent, targetAnchorId: string) => {
      this.bindingGraph.addComponent(this.id, this.anchors);
      this.bindingGraph.addComponent(targetComponent.id, targetComponent.anchors);

      const bindingId = this.bindingGraph.addBinding(
        this.id,
        anchorId,
        targetComponent.id,
        targetAnchorId
      );

      return targetComponent;
    };

    // Create proxy that can be called as a function
    return new Proxy(bindFn, {
      apply: (target, thisArg, args) => {
        //@ts-ignore
        return target.apply(thisArg, args);
      },
      get: (target, prop) => {
        if (prop === 'bind') {
          return target;
        }
        const anchor = this.anchors.get(anchorId);
        return anchor?.[prop as keyof Anchor];
      }
    }) as BindFunction;
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