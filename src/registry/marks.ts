import { Anchor } from '../types/anchors';
import { generateId } from '../utils/id';
import { BaseComponent } from '../components/base';
// Component base
export interface Component {
    id: string;
    type: string;
    anchors: Map<string, Anchor>;
    getSpec(): any;
  }
  
export class MarkRegistry {
    private static instance: MarkRegistry;
    private marks: Map<string, new (config: any) => BaseComponent> = new Map();
  
    // Update the register method signature
    register(type: string, markClass: new (config: any) => BaseComponent) {
      this.marks.set(type, markClass);
    }
  
    static getInstance() {
      if (!MarkRegistry.instance) {
        MarkRegistry.instance = new MarkRegistry();
      }
      return MarkRegistry.instance;
    }
 
    create(type: string, config: any): BaseComponent {
      const MarkClass = this.marks.get(type);
      if (!MarkClass) throw new Error(`Unknown mark type: ${type}`);
      if (MarkClass.prototype.constructor.name === 'Mark') {
        throw new Error(`Cannot instantiate abstract Mark class directly`);
      }
      //@ts-ignore
      return new MarkClass(config);
    }
  }