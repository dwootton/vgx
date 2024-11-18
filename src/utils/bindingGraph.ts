import { generateId } from 'utils';
import { AnchorSchema, AnchorId,AnchorGroupSchema, AnchorOrGroupSchema, AnchorProxy } from '../types/anchors';
import {  Binding } from '../types/compilation';
import { generateAnchorId } from './id';

interface IBindingGraph {
  addBinding(parentAnchorId: AnchorId, childAnchorId: AnchorId): string;
  getBindings(componentId?: string): Binding[];
  getSourceBindings(componentId: string): Binding[];
  getTargetBindings(componentId: string): Binding[];
  removeBinding(bindingId: string): void;
  removeComponentBindings(componentId: string): void;
}

export class BindingGraph {
  private bindings: Map<string, Binding> = new Map();
  public bindingTree: { name: string, children: { name: string, children: any[] }[] } = {
    "name": "root",
    "children": []
  };
  constructor() {
    this.bindingTree = {
      "name": "root",
      "children": []
    };
  }

  addBinding(
    parentAnchorId: AnchorId,
    childAnchorId: AnchorId
  ): string {
    const bindingId = `binding_${generateAnchorId(parentAnchorId)}_${generateAnchorId(childAnchorId)}`;
    
    const binding: Binding = {
        id: bindingId,
        parentAnchorId: parentAnchorId,
        childAnchorId: childAnchorId,
      };

    this.bindings.set(bindingId, binding);


    this.addToNestedTree(parentAnchorId, childAnchorId);
    
  
    //navigate to find the node in the binding tree and add the child
    
    return bindingId;
  }

  addToNestedTree(parentAnchorId: AnchorId, childAnchorId: AnchorId) {
    //navigate to find the node in the binding tree and add the child
    // Add to binding tree
    const findNode = (node: any, targetId: string): any => {
      if (node.name === targetId) return node;
      if (!node.children) return null;
      
      for (const child of node.children) {
        const found = findNode(child, targetId);
        if (found) return found;
      }
      return null;
    };

    // Try to find parent node
    const parentNode = findNode(this.bindingTree, generateAnchorId(parentAnchorId));

    // If parent not found, add to root
    if (!parentNode) {
      this.bindingTree.children.push({
        name: generateAnchorId(parentAnchorId),
        children: [{
          name: generateAnchorId(childAnchorId),
          children: []
        }]
      });
    } else {
      // Add child to existing parent
      if (!parentNode.children) {
        parentNode.children = [];
      }
      parentNode.children.push({
        name: generateAnchorId(childAnchorId),
        children: []
      });
    }

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
