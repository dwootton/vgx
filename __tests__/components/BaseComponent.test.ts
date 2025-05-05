import { DragComponent } from '../../src/components/interaction/DragComponent';
import { CircleComponent } from '../../src/components/marks/CircleComponent';
import { BindingManager } from '../../src/binding/BindingManager';

// Test component that exposes protected methods


describe('BaseComponent', () => {
  describe('portGroup Management', () => {
    test('should add and get portGroups', () => {
      const component = new DragComponent({});
      // @ts-ignore as we are testing a protected methods
      component.registerPortGroup({
        id: 'test',
        name: 'Test portGroup',
        ports: new Map()
      });

      const group = component.getPortGroup('test');
      expect(group).toBeDefined();
      expect(group?.id).toBe('test');
      expect(group?.name).toBe('Test portGroup');
    });

    test('should get default portGroup', () => {
      const component = new DragComponent({});
      const defaultGroup = component.getPortGroup('default');

      expect(defaultGroup).toBeDefined();
      expect(defaultGroup?.id).toBe('default');
    });
  });

  // describe('Port Management', () => {
  //   test('should register and get ports', () => {
  //     const component = new TestComponent();
  //     component.registerTestPort('testPort', ChannelType.X, 'test');

  //     const ports = component.getPortsForportGroup('test');
  //     expect(ports).toHaveLength(1);
  //     expect(ports[0].name).toBe('testPort');
  //     expect(ports[0].type).toBe(ChannelType.X);
  //   });
  // });

  describe('Binding Configuration', () => {
    test('should handle direct component binding', () => {
      const circle = new CircleComponent({});
      const drag = new DragComponent({});
      drag.bind(circle);

      const bindings = BindingManager.getInstance().getBindingsForComponent(drag.getId());
      expect(bindings).toHaveLength(1);
      expect(bindings[0].source.portGroup).toBe('default');
      expect(bindings[0].target.portGroup).toBe('default');
    });

    test('should handle array of component bindings', () => {
      const circle1 = new CircleComponent({});
      const circle2 = new CircleComponent({});
      const drag = new DragComponent({});
      drag.bind(circle1);
      drag.bind(circle2);

      const bindings = BindingManager.getInstance().getBindingsForComponent(drag.getId());
      expect(bindings).toHaveLength(2);
      expect(bindings[0].source.portGroup).toBe('default');
      expect(bindings[1].source.portGroup).toBe('default');
    });

    test('should handle portGroup-specific bindings', () => {
      const circle = new CircleComponent({});
      const drag = new DragComponent({});
      drag.bindGroup('span', circle);

      const bindings = BindingManager.getInstance().getBindingsForComponent(drag.getId());
      expect(bindings).toHaveLength(1);
      expect(bindings[0].source.portGroup).toBe('span');
      expect(bindings[0].target.portGroup).toBe('default');
    });
  });
}); 