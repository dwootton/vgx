/// <reference types="jest" />

import { isPortTypeCompatible } from '../src/binding/compatabilityUtils';
import { 
  PortType, 
  ChannelType, 
  DataPortType, 
  MarkPortType, 
  InteractionPortType, 
  MiscPortType,
  AllPortTypes
} from '../src/types/portTypes';

describe('CompatibilityUtils', () => {
  // Port Type Compatibility Tests
  describe('isPortTypeCompatible', () => {
    test('should return true for identical port types', () => {
      expect(isPortTypeCompatible(ChannelType.X, ChannelType.X)).toBe(true);
      expect(isPortTypeCompatible(ChannelType.COLOR, ChannelType.COLOR)).toBe(true);
      expect(isPortTypeCompatible(DataPortType.DATA, DataPortType.DATA)).toBe(true);
    });
    
    test('should return true for compatible port types', () => {
      // X should be compatible with X1 and X2
      expect(isPortTypeCompatible(ChannelType.X, ChannelType.X1)).toBe(true);
      expect(isPortTypeCompatible(ChannelType.X, ChannelType.X2)).toBe(true);
      
      // Y should be compatible with Y1 and Y2
      expect(isPortTypeCompatible(ChannelType.Y, ChannelType.Y1)).toBe(true);
      expect(isPortTypeCompatible(ChannelType.Y, ChannelType.Y2)).toBe(true);
    });
    
    test('should return false for incompatible port types', () => {
      expect(isPortTypeCompatible(ChannelType.X, ChannelType.COLOR)).toBe(false);
      expect(isPortTypeCompatible(ChannelType.Y, ChannelType.SIZE)).toBe(false);
      expect(isPortTypeCompatible(MarkPortType.MARK_NAME, InteractionPortType.SELECTION)).toBe(false);
    });
    
    test('should handle spatial variants correctly', () => {
      // Note: this may be changed in the future, but for now, we'll keep spatial variants as separate types
      expect(isPortTypeCompatible(ChannelType.X1, ChannelType.X2)).toBe(false);
      expect(isPortTypeCompatible(ChannelType.Y1, ChannelType.Y2)).toBe(false);
    });
    
    test('should handle interaction port types', () => {
      expect(isPortTypeCompatible(InteractionPortType.SELECTION, InteractionPortType.SELECTION)).toBe(true);
      expect(isPortTypeCompatible(InteractionPortType.FILTER, InteractionPortType.FILTER)).toBe(true);
      expect(isPortTypeCompatible(InteractionPortType.SELECTION, InteractionPortType.FILTER)).toBe(false);
    });
    
    test('should handle data port types', () => {
      expect(isPortTypeCompatible(DataPortType.DATA, DataPortType.DATA)).toBe(true);
      expect(isPortTypeCompatible(DataPortType.FIELD, DataPortType.FIELD)).toBe(true);
      expect(isPortTypeCompatible(DataPortType.DATA, DataPortType.FIELD)).toBe(false);
    });
  });
});