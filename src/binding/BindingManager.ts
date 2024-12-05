import { BaseComponent } from "components/base";

// Simple binding manager to track component bindings
export class BindingManager {
    private bindings: Array<{sourceId: string, targetId: string, sourceAnchor: string, targetAnchor: string}>;
    private static instance: BindingManager;
    private components: Map<string, BaseComponent>;
    private constructor() {
      this.bindings = [];
      this.components = new Map();
    }
  
    public static getInstance(): BindingManager {
      if (!BindingManager.instance) {
        BindingManager.instance = new BindingManager();
      }
      return BindingManager.instance;
    }

    public getComponent(componentId: string): BaseComponent | undefined {
      return this.components.get(componentId);
    }
  
    public addComponent(component: BaseComponent) {
      this.components.set(component.id, component);
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
  