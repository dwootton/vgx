import { Port } from '../../src/components/base';

/**
 * Mock implementation of BaseComponent for testing
 */
export class MockBaseComponent {
  id: string;
  
  constructor(id: string) {
    this.id = id;
  }
  
  // Add ports-related methods for testing
  getPortReferences(portGroup?: string): Map<string, Port> {
    return new Map();
  }

  getPortsForportGroup(portGroup: string): Map<string, Port> {
    return new Map();
  }

  hasportGroup(portGroupId: string): boolean {
    return portGroupId === 'default';
  }

  getDefaultportGroup(): { id: string } | null {
    return { id: 'default' };
  }
  
  // Add other methods/properties as needed for testing
} 