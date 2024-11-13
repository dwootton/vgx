import { AnchorSchema, AnchorId,AnchorGroupSchema, AnchorOrGroupSchema, AnchorProxy } from '../types/anchors';
import {  Binding } from '../types/compilation';


export class BindingGraph {
  private bindings: Map<string, Binding> = new Map();
  constructor() {}

  splitGroup(group: AnchorGroupSchema): AnchorSchema[] {
    return Array.from(group.children.values());
  }

  addBinding(
    parentAnchorId: AnchorId,
    childAnchorId: AnchorId
  ): string {
    const bindingId = `binding_${Date.now()}_${Math.random()}`;
    
    const binding: Binding = {
        id: bindingId,
        parentAnchorId: parentAnchorId,
        childAnchorId: childAnchorId,
      };

    this.bindings.set(bindingId, binding);
    return bindingId;
  }



  // Get all bindings for a component, both source and target
  getBindings(componentId?: string): Binding[] {
    // if (componentId) {
    //   return Array.from(this.bindings.values()).filter(binding => 
    //     binding.source.component.id === componentId ||
    //     binding.target.component.id === componentId
    //   );
    // }
    return Array.from(this.bindings.values());
  }

  // Get bindings where component is source
  getSourceBindings(componentId: string): Binding[] {
    return Array.from(this.bindings.values()).filter(binding => 
      binding.parentAnchorId.componentId === componentId 
    );
  }

  // Get bindings where component is target
  getTargetBindings(componentId: string): Binding[] {
    // console.log('getTargetBindings', componentId, this.bindings.values());
    const vals =  Array.from(this.bindings.values()).filter(binding => {
      return binding.childAnchorId.componentId === componentId;
    });
    
    return vals;
  }

  // Remove a binding
  removeBinding(bindingId: string) {
    this.bindings.delete(bindingId);
  }

  // Remove all bindings for a component
  removeComponentBindings(componentId: string) {
    const bindingsToRemove = this.getBindings(componentId);
    bindingsToRemove.forEach(binding => {
      this.bindings.delete(binding.id);
    });
  }

  // Get a specific binding
  getBinding(bindingId: string): Binding | undefined {
    return this.bindings.get(bindingId);
  }
}
