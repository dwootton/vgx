import { BaseComponent } from "../components/base";
import { Point, Line } from "../types/geometry";
import { AnchorOrGroupSchema } from "../types/anchors";
import { RectAnchorConfig } from "./rect";

export interface MouceEventAnchorConfig {
    x?: number; // TODO: change this and y to Field
    y?: number; 
    movementX?: number; // distance X since last mouse move event
    movementY?: number; // distance Y since last mouse move event
}


export class EventAnchors {
    constructor() {}

    protected anchors: Map<string, AnchorOrGroupSchema> = new Map();
  
    private createEventAnchors(
      config: MouceEventAnchorConfig,
      anchorConfigs: Array<[string, (c: MouceEventAnchorConfig) => any]>,
      groupName: string
    ) {
      // Create individual anchors
      anchorConfigs.forEach(([name, getGeometry]) => {
        this.anchors.set(name, {
          id: (name),
          type: 'event',
          
        });
      });
  
      // Create group
      this.anchors.set(groupName, {
        id: (groupName),
        type: 'group',
        children: new Map(anchorConfigs.map(([name]) => {
            const anchor = this.anchors.get(name);
            if (!anchor) throw new Error(`Anchor "${name}" not found`);
            if ('type' in anchor && anchor.type === 'group') throw new Error(`Nested groups are not allowed: "${name}"`);
            return [name, anchor];
          })),
      });
    }
  
    initializeMouseAnchors(providedConfig?: MouceEventAnchorConfig) {

      const config = providedConfig || {"x":0, "y":0, "event": "click", "movementX": 0, "movementY": 0};
      
      // Define anchor configurations
      const betweenConfigs = [
        ['start', (c: MouceEventAnchorConfig) => ({ x: c.x })],
        ['stop', (c: MouceEventAnchorConfig) => ({ y: c.y })],
      ] as const;
  

      this.createEventAnchors(config, betweenConfigs.map(c => [...c]), 'between');

      return this.anchors;
    }
}


  
export class MouseEventAnchors extends EventAnchors {
    constructor() {
        super();
    }

    protected anchors: Map<string, AnchorOrGroupSchema> = new Map();
  
    private createGeometricAnchors(
      config: MouceEventAnchorConfig,
      anchorConfigs: Array<[string, (c: MouceEventAnchorConfig) => any]>,
      groupName: string
    ) {
      // Create individual anchors
      anchorConfigs.forEach(([name, getGeometry]) => {
        this.anchors.set(name, {
          id: (name),
          type: 'geometric',
          geometry: getGeometry(config),
        });
      });
  
      // Create group
      this.anchors.set(groupName, {
        id: (groupName),
        type: 'group',
        children: new Map(anchorConfigs.map(([name]) => {
            const anchor = this.anchors.get(name);
            if (!anchor) throw new Error(`Anchor "${name}" not found`);
            if ('type' in anchor && anchor.type === 'group') throw new Error(`Nested groups are not allowed: "${name}"`);
            return [name, anchor];
          })),
      });
    }
  
    initializeMouseAnchors(providedConfig?: MouceEventAnchorConfig) {

      const config = providedConfig || {"x":0, "y":0, "event": "click", "movementX": 0, "movementY": 0};
      
      // Define anchor configurations
      const positionConfigs = [
        ['x', (c: MouceEventAnchorConfig) => ({ x: c.x })],
        ['y', (c: MouceEventAnchorConfig) => ({ y: c.y })],
      ] as const;
  
      const movementConfigs = [
        ['movementX', (c: MouceEventAnchorConfig) => ({ x: c.movementX })],
        ['movementY', (c: MouceEventAnchorConfig) => ({ y: c.movementY })],
      ] as const;
  

      this.createGeometricAnchors(config, positionConfigs.map(c => [...c]), 'center');
      this.createGeometricAnchors(config, movementConfigs.map(c => [...c]), 'movement');

      
  
      return this.anchors;
    }
  }