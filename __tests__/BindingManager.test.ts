/// <reference types="jest" />

import { BindingManager } from '../src/binding/BindingManager';
import { CircleComponent } from '../src/components/marks/CircleComponent';
import { DragComponent } from '../src/components/interaction/DragComponent';
import { AllPortTypes, MiscPortType } from '../src/types/portTypes';

// Mock console.warn to check warnings
const originalConsoleWarn = console.warn;
const mockConsoleWarn = jest.fn();

beforeEach(() => {
  // Reset all mocks
  console.warn = mockConsoleWarn;
});

afterEach(() => {
  // Restore original console.warn
  console.warn = originalConsoleWarn;
  jest.clearAllMocks();
  
  // Reset BindingManager singleton
  // @ts-ignore - Accessing private field for testing
  BindingManager.instance = undefined;
});

describe('BindingManager', () => {
  let bindingManager: BindingManager;
  let circle: CircleComponent;
  let drag: DragComponent;

  beforeEach(() => {
    bindingManager = new BindingManager();
    circle = new CircleComponent({});
    drag = new DragComponent({});
  });

  describe('Component Management', () => {
    it('should add and get a component', () => {
      bindingManager.addComponent(circle);
      expect(bindingManager.getComponent(circle.getId())).toBe(circle);
    });

    it('should throw error when getting non-existent component', () => {
      expect(() => bindingManager.getComponent('nonexistent')).toThrow('Component "nonexistent" not found.');
    });

    it('should remove a component', () => {
      bindingManager.addComponent(circle);
      bindingManager.addComponent(drag);

      // Add a binding between components
      bindingManager.addBinding(
        drag.getId(),
        circle.getId(),
        'default',
        'default',
        MiscPortType.ALL,
        MiscPortType.ALL
      );

      // Remove circle component
      bindingManager.removeComponent(circle.getId());

      // Verify component is removed
      expect(() => bindingManager.getComponent(circle.getId())).toThrow();

      // Verify bindings are cleaned up
      const remainingBindings = bindingManager.getBindingsForComponent(drag.getId());
      expect(remainingBindings).toHaveLength(0);
    });

    it('should get all components', () => {
      bindingManager.addComponent(circle);
      bindingManager.addComponent(drag);
      const components = bindingManager.getComponents();
      expect(components).toHaveLength(2);
      expect(components).toContain(circle);
      expect(components).toContain(drag);
    });
  });

  describe('Binding Management', () => {
    it('should add a valid binding', () => {
      bindingManager.addComponent(circle);
      bindingManager.addComponent(drag);

      bindingManager.addBinding(
        drag.getId(),
        circle.getId(),
        'default',
        'default',
        MiscPortType.ALL,
        MiscPortType.ALL
      );

      const bindings = bindingManager.getBindings();
      expect(bindings).toHaveLength(1);
      expect(bindings[0]).toEqual({
        source: {
          componentId: drag.getId(),
          portGroup: 'default',
          portType: MiscPortType.ALL,
          isInternal: false
        },
        target: {
          componentId: circle.getId(),
          portGroup: 'default',
          portType: MiscPortType.ALL,
          isInternal: false
        },
        metaData: {
          role: 'direct',
          isImplicit: false
        }
      });
    });

    it('should not add duplicate binding', () => {
      bindingManager.addComponent(circle);
      bindingManager.addComponent(drag);

      bindingManager.addBinding(
        drag.getId(),
        circle.getId(),
        'default',
        'default',
        MiscPortType.ALL,
        MiscPortType.ALL
      );

      bindingManager.addBinding(
        drag.getId(),
        circle.getId(),
        'default',
        'default',
        MiscPortType.ALL,
        MiscPortType.ALL
      );

      const bindings = bindingManager.getBindings();
      expect(bindings).toHaveLength(1);
    });

    it('should filter bindings by component ID and type', () => {
      bindingManager.addComponent(circle);
      bindingManager.addComponent(drag);

      bindingManager.addBinding(
        drag.getId(),
        circle.getId(),
        'default',
        'default',
        MiscPortType.ALL,
        MiscPortType.ALL
      );

      const sourceBindings = bindingManager.getBindingsForComponent(drag.getId(), 'source');
      const targetBindings = bindingManager.getBindingsForComponent(circle.getId(), 'target');

      expect(sourceBindings).toHaveLength(1);
      expect(targetBindings).toHaveLength(1);
      expect(sourceBindings[0]).toEqual({
        source: {
          componentId: drag.getId(),
          portGroup: 'default',
          portType: MiscPortType.ALL,
          isInternal: false
        },
        target: {
          componentId: circle.getId(),
          portGroup: 'default',
          portType: MiscPortType.ALL,
          isInternal: false
        },
        metaData: {
          role: 'direct',
          isImplicit: false
        }
      });
      expect(targetBindings[0]).toEqual({
        source: {
          componentId: drag.getId(),
          portGroup: 'default',
          portType: MiscPortType.ALL,
          isInternal: false
        },
        target: {
          componentId: circle.getId(),
          portGroup: 'default',
          portType: MiscPortType.ALL,
          isInternal: false
        },  
        metaData: {
          role: 'direct',
          isImplicit: false
        }
      });
    });

    it('should remove a specific binding', () => {
      bindingManager.addComponent(circle);
      bindingManager.addComponent(drag);

      bindingManager.addBinding(
        drag.getId(),
        circle.getId(),
        'default',
        'default',
        MiscPortType.ALL,
        MiscPortType.ALL
      );

      const binding = bindingManager.getBindingsForComponent(drag.getId(), 'source')[0];
      bindingManager.removeBinding(binding);
      const bindings = bindingManager.getBindingsForComponent(drag.getId(), 'source');
      expect(bindings).toHaveLength(0);
    });
  });
}); 