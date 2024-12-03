import { Field } from 'vega-lite/build/src/channeldef';
import { TopLevelSpec, UnitSpec } from 'vega-lite/build/src/spec';
import { generateId } from '../utils/id';

export interface Component {
  id: string;
  type: string;
  getSpec(): any;
}

export abstract class BaseComponent {
  id: string;

  constructor() {
    this.id = generateId();
  }

  abstract compileComponent(): Partial<UnitSpec<Field>>;

  compile(): TopLevelSpec {
    // find the root of the component tree
    return this.compileComponent() as TopLevelSpec;
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
