import { BindingManager } from '../../src/binding/BindingManager';
import { DragComponent } from '../../src/components/interaction/DragComponent';
import { ChannelType } from '../../src/types/portTypes';
import { vgx } from '../../src/vgx';

describe('DragComponent', () => {
  test('should register default and span portGroup ports', () => {
    const drag = new DragComponent({});
    const portGroups = drag.getPortGroups();
    
    // Check default portGroup ports
    const defaultPorts = drag.getPortReferencesForGroup('default')
    expect(defaultPorts).toBeDefined();
    expect(defaultPorts?.find(port => port.portType === ChannelType.X)?.portType).toBe(ChannelType.X);
    expect(defaultPorts?.find(port => port.portType === ChannelType.Y)?.portType).toBe(ChannelType.Y);
    
    // Check span portGroup ports
    const spanPorts = drag.getPortReferencesForGroup('span');
    expect(spanPorts).toBeDefined();
    expect(spanPorts?.find(port => port.portType === ChannelType.X1)?.portType).toBe(ChannelType.X1);
    expect(spanPorts?.find(port => port.portType === ChannelType.Y1)?.portType).toBe(ChannelType.Y1);
    expect(spanPorts?.find(port => port.portType === ChannelType.X2)?.portType).toBe(ChannelType.X2);
    expect(spanPorts?.find(port => port.portType === ChannelType.Y2)?.portType).toBe(ChannelType.Y2);
  });

  test('should handle span portGroup bindings', () => {
    const target = vgx.rect({});
    const drag = vgx.drag({
        span: target
    });
    
    const bindings = BindingManager.getInstance().getBindingsForComponent(drag.getId());
    expect(bindings).toHaveLength(1);
    expect(bindings[0].source.portGroup).toBe('span');
    expect(bindings[0].target.portGroup).toBe('default');
  });
}); 