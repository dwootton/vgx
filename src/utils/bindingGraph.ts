import { Anchor, AnchorOrGroup } from '../types/anchors';
import { Binding } from '../types/compilation';

export class BindingGraph {
  private bindings: Map<string, Binding> = new Map();
  constructor() {}

  addBinding(
    sourceComponentId: string,
    sourceAnchorId: string,
    sourceType: 'geometric' | 'encoding' | 'event' | 'group',
    targetComponentId: string,
    targetAnchorId: string,
    targetType: 'geometric' | 'encoding' | 'event' | 'group'
  ): string {
    const bindingId = `binding_${Date.now()}_${Math.random()}`;
    
    const binding: Binding = {
      id: bindingId,
      source: {
        componentId: sourceComponentId,
        anchorId: sourceAnchorId
      },
      target: {
        componentId: targetComponentId,
        anchorId: targetAnchorId
      },
      sourceType,
      targetType
    };

    this.bindings.set(bindingId, binding);
    return bindingId;
  }

  // Get all bindings for a component
  getBindings(componentId?: string): Binding[] {
    if (componentId) {
      return Array.from(this.bindings.values()).filter(binding => 
        binding.source.componentId === componentId ||
        binding.target.componentId === componentId
      );
    }
    return Array.from(this.bindings.values());
  }

  // Get bindings where component is source
  getSourceBindings(componentId: string, anchorId?: string): Binding[] {
    return Array.from(this.bindings.values()).filter(binding => 
      binding.source.componentId === componentId &&
      (!anchorId || binding.source.anchorId === anchorId)
    );
  }

  // Get bindings where component is target
  getTargetBindings(componentId: string, anchorId?: string): Binding[] {
    return Array.from(this.bindings.values()).filter(binding => 
      binding.target.componentId === componentId &&
      (!anchorId || binding.target.anchorId === anchorId)
    );
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
