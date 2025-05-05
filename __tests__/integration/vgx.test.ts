import { vgx } from '../../src/vgx';
import { MiscPortType, AllPortTypes } from '../../src/types/portTypes';
import { BindingManager } from '../../src/binding/BindingManager';

describe('VGX Integration', () => {
  test('should create interactive scatterplot with drag', () => {
    const data = [{ x: 1, y: 2 }];
    const circle = vgx.circle({
      bind: vgx.drag({})
    })

    const plot = vgx.scatterplot({
      data: data,
      x: 'x',
      y: 'y',
      bind: circle
    });


    // Check scatterplot bindings
    const scatterBindings = BindingManager.getInstance().getBindingsForComponent(plot.getId());
    expect(scatterBindings).toHaveLength(1);
    expect(scatterBindings[0].source.portType).toBe(MiscPortType.ALL);
    expect(scatterBindings[0].target.portType).toBe(MiscPortType.ALL);

    // Get the circle component through the binding
    const circleId = circle.getId();
    const newCircle = vgx.circle({});
    expect(newCircle.getId()).not.toBe(circleId); // Different instance

    // Check circle bindings
    const circleBindings = BindingManager.getInstance().getBindingsForComponent(circle.getId());
    expect(circleBindings).toHaveLength(2);
  });

  test('should create drag component with span portGroup binding', () => {
    const drag = vgx.drag({
      span: vgx.circle({})
    });

    const bindings = BindingManager.getInstance().getBindingsForComponent(drag.getId());
    expect(bindings).toHaveLength(1);
    expect(bindings[0].source.portGroup).toBe('span');
    expect(bindings[0].source.portType).toBe(MiscPortType.ALL);
    expect(bindings[0].target.portGroup).toBe('default');
    expect(bindings[0].target.portType).toBe(MiscPortType.ALL);
  });
}); 