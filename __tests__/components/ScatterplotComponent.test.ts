import { ScatterplotComponent } from '../../src/components/charts/ScatterplotComponent';
import { ChannelType, DataPortType , AllPortTypes} from '../../src/types/portTypes';

describe('ScatterplotComponent', () => {
  test('should register default ports', () => {
    const scatter = new ScatterplotComponent({
      data: [],
      x:'x',
      y:'y',
    });
    
    const portGroups = scatter.getPortGroups();
    const defaultPorts = portGroups.get('default');
    
    expect(defaultPorts?.ports.get(ChannelType.X)).toBeDefined();
    expect(defaultPorts?.ports.get(ChannelType.Y)).toBeDefined();
    expect(defaultPorts?.ports.get(ChannelType.COLOR)).toBeDefined();
    expect(defaultPorts?.ports.get(ChannelType.SIZE)).toBeDefined();
    expect(defaultPorts?.ports.get(DataPortType.DATA)).toBeDefined();
  });

  // TODO add tests for derived ports

}); 