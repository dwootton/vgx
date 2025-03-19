import { BaseComponent } from 'components/base';
import { BindingManager } from '../binding/BindingManager';

// Get reference to the singleton binding manager
const bindingManager = BindingManager.getInstance();

/**
 * Creates a component factory that works in two ways:
 * 1. Called as constructor to create a new component
 * 2. Accessed as object to get properties from most recent instance
 */
export function createComponentFactory<T>(
  ComponentClass: new (...args: any[]) => T,
): any {
  // Create the factory function
  const factory = function(...args: any[]): T {
    // Create a new instance
    const instance = new ComponentClass(...args);
    return instance;
  };

  // Create a proxy to intercept property access
  return new Proxy(factory, {
    // Handle property access (like brush.data)
    get(target, prop, receiver) {
      // If accessing a property on the factory function itself
      if (prop in target) {
        return Reflect.get(target, prop, receiver);
      }
      
      // Get the component type from the constructor name
      const componentType = ComponentClass.name.toLowerCase();

      function cleanComponentType(componentType: string): string {
        return componentType.replace(/constructor/g, '').trim();
      }
      
      // Otherwise, find the most recent instance of this component type
      const recentInstance = findMostRecentComponentByType(cleanComponentType(componentType));
      
      if (recentInstance && prop in recentInstance) {
        return recentInstance[prop as keyof T];
      }
      
      // Fallback for undefined properties
      return undefined;
    }
  });
}

/**
 * Find the most recently created component of a given type using the binding manager
 */
function findMostRecentComponentByType(componentType: string): BaseComponent | null {
  // Get all nodes from the binding manager
  const allNodes = bindingManager.getComponents();
  
  // Filter nodes by component type and sort by ID number to get most recent
  const matchingNodes = Array.from(allNodes.values())
    .filter(node => {
      // Check if the node ID matches the pattern node_{type}_{number}
      // or just node_{number} and we need to check the actual component type
      const idMatch = node.id.match(/^node_(\w+)_(\d+)$/) || node.id.match(/^node_(\d+)$/);
      
      if (!idMatch) return false;
      
      // If the ID includes the component type, check if it matches
      if (idMatch[1] && isNaN(Number(idMatch[1]))) {
        return idMatch[1].toLowerCase() === componentType.toLowerCase();
      }
      
      // Otherwise check the actual component type
      return node.constructor.name.toLowerCase() === componentType.toLowerCase();
    })
    .sort((a, b) => {
      // Extract node numbers to sort by most recent (highest number)
      const aMatch = a.id.match(/(\d+)$/);
      const bMatch = b.id.match(/(\d+)$/);
      
      if (!aMatch || !bMatch) return 0;
      
      return parseInt(bMatch[1]) - parseInt(aMatch[1]);
    });
  
  // Return the most recent one (first after sorting)
  return matchingNodes.length > 0 ? matchingNodes[0] : null;
}