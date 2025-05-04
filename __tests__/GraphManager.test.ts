/// <reference types="jest" />

import { GraphManager, BindingGraph } from '../src/binding/GraphManager';
import { BindingManager } from '../src/binding/BindingManager';
import { CircleComponent } from '../src/components/marks/CircleComponent';
import { DragComponent } from '../src/components/interaction/DragComponent';
import { ScatterplotComponent } from '../src/components/charts/ScatterplotComponent';
import { AllPortTypes, ChannelType, MiscPortType } from '../src/types/portTypes';

describe('GraphManager', () => {
  let bindingManager: BindingManager;
  let graphManager: GraphManager;

  beforeEach(() => {
    bindingManager = new BindingManager();
    graphManager = new GraphManager(() => bindingManager);
  });

  describe('generateBindingGraph', () => {
    test('should generate graph for scatterplot with circle and drag', () => {
      // Create components
      const scatter = new ScatterplotComponent({
        "default": {
          [AllPortTypes.DATA]: [{ x: 1, y: 2 }],
          [AllPortTypes.XFIELD]: 'x',
          [AllPortTypes.YFIELD]: 'y'
        }
      });
      const circle = new CircleComponent({});
      const drag = new DragComponent({});

      // Register components
      bindingManager.addComponent(scatter);
      bindingManager.addComponent(circle);
      bindingManager.addComponent(drag);

      // Add bindings
      bindingManager.addBinding(
        scatter.getId(),
        circle.getId(),
        'default',
        'default',
        MiscPortType.ALL,
        MiscPortType.ALL
      );

      bindingManager.addBinding(
        circle.getId(),
        drag.getId(),
        'default',
        'default',
        MiscPortType.ALL,
        MiscPortType.ALL
      );

      // Generate graph starting from scatterplot
      const graph = graphManager.generateBindingGraph(scatter);

      // Verify nodes
      expect(graph.nodes).toHaveLength(3);
      expect(graph.nodes.map(n => n.component.constructor.name)).toEqual([
        'ScatterplotComponent',
        'CircleComponent',
        'DragComponent'
      ]);

      // Verify edges
      expect(graph.edges).toHaveLength(2);
      expect(graph.edges[0].source.componentId).toBe(scatter.getId());
      expect(graph.edges[0].target.componentId).toBe(circle.getId());
      expect(graph.edges[1].source.componentId).toBe(circle.getId());
      expect(graph.edges[1].target.componentId).toBe(drag.getId());
    });

    test('should handle drag component with span portGroup binding', () => {
      // Create components
      const circle = new CircleComponent({});
      const drag = new DragComponent({});

      // Register components
      bindingManager.addComponent(drag);
      bindingManager.addComponent(circle);

      // Add binding in span portGroup
      bindingManager.addBinding(
        drag.getId(),
        circle.getId(),
        'span',
        'default',
        MiscPortType.ALL,
        MiscPortType.ALL
      );

      // Generate graph starting from drag
      const graph = graphManager.generateBindingGraph(drag);

      // Verify nodes
      expect(graph.nodes).toHaveLength(2);
      expect(graph.nodes.map(n => n.component.constructor.name)).toEqual([
        'DragComponent',
        'CircleComponent'
      ]);

      // Verify edges
      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0].source.componentId).toBe(drag.getId());
      expect(graph.edges[0].target.componentId).toBe(circle.getId());
      expect(graph.edges[0].source.portGroup).toBe('span');
      expect(graph.edges[0].target.portGroup).toBe('default');
    });
  });

  describe('expandEdges', () => {
    test('should expand edges between drag and circle components', () => {
      // Create components
      const circle = new CircleComponent({});
      const drag = new DragComponent({});

      // // Register components
      bindingManager.addComponent(drag);
      bindingManager.addComponent(circle);

      // // Add binding
      bindingManager.addBinding(
        drag.getId(),
        circle.getId(),
        'default',
        'default',
        MiscPortType.ALL,
        MiscPortType.ALL
      );

      // Generate and expand graph
      const graph = graphManager.generateBindingGraph(drag);
      const expandedEdges = graphManager.expandEdges(graph);

      // Verify expanded edges
      expect(expandedEdges).toHaveLength(2);
      // expect(expandedEdges[0].source.portType).toBe(ChannelType.X);
      // expect(expandedEdges[0].target.portType).toBe(ChannelType.X);
      // expect(expandedEdges[0].source.nodeId).toBe(drag.getId());
      // expect(expandedEdges[0].target.nodeId).toBe(circle.getId());
    });

    test('should expand edges with multiple port types', () => {
      // Create components
      const scatter = new ScatterplotComponent({
        "default": {
          [AllPortTypes.DATA]: [{ x: 1, y: 2 }],
          [AllPortTypes.XFIELD]: 'x',
          [AllPortTypes.YFIELD]: 'y'
        }
      });
      const circle = new CircleComponent({});

      // Register components
      bindingManager.addComponent(scatter);
      bindingManager.addComponent(circle);

      // Add bindings for multiple port types
      bindingManager.addBinding(
        scatter.getId(),
        circle.getId(),
        'default',
        'default',
        ChannelType.X,
        ChannelType.X,
      );
      bindingManager.addBinding(
        scatter.getId(),
        circle.getId(),
        'default',
        'default',
        ChannelType.Y,
        ChannelType.Y,
      );
      bindingManager.addBinding(
        scatter.getId(),
        circle.getId(),
        'default',
        'default',
        ChannelType.COLOR,
        ChannelType.COLOR,
      );

      // Generate and expand graph
      const graph = graphManager.generateBindingGraph(scatter);
      const expandedEdges = graphManager.expandEdges(graph);

      // Verify expanded edges
      expect(expandedEdges).toHaveLength(3);
      const portTypes = expandedEdges.map(e => e.source.portType);
      expect(portTypes).toContain(ChannelType.X);
      expect(portTypes).toContain(ChannelType.Y);
      expect(portTypes).toContain(ChannelType.COLOR);
    });
  });
}); 