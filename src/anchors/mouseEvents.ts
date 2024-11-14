import { BaseComponent } from "../components/base";
import { Point, Line } from "../types/geometry";
import { AnchorOrGroupSchema } from "../types/anchors";
import { RectAnchorConfig } from "./rect";

export interface MouceEventAnchorConfig {
    x: number; // TODO: change this and y to Field
    y: number; 
    event: 'click' | 'dblclick' | 'mouseover' | 'mouseout' | 'mousedown' | 'mouseup' | 'mousemove';
    movementX: number; // distance X since last mouse move event
    movementY: number; // distance Y since last mouse move event
}
  
export class MouseEventAnchors {
    private component: BaseComponent;
    constructor(component: BaseComponent) {
        this.component = component;
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
  
    initializeRectAnchors(providedConfig?: MouceEventAnchorConfig) {

      const config = providedConfig || {"x":0, "y":0, "event": "click", "movementX": 0, "movementY": 0};

        //  // define xy position and all mouse events ancho

      
      // Define anchor configurations
      const positionConfigs = [
        ['x', (c: MouceEventAnchorConfig) => ({ x: c.x })],
        ['y', (c: MouceEventAnchorConfig) => ({ y: c.y })],
      ] as const;
  
      const movementConfigs = [
        ['movementX', (c: MouceEventAnchorConfig) => ({ x: c.movementX })],
        ['movementY', (c: MouceEventAnchorConfig) => ({ y: c.movementY })],
      ] as const;
  
      const xConfigs = [
        ['x1', (c: RectAnchorConfig) => ({ x1: c.x1 , x2: c.x1, y1: c.y1 ,y2: c.y2 })],
        ['x2', (c: RectAnchorConfig) => ({ x1: c.x2, x2:c.x2 ,y1: c.y1 ,y2: c.y2 })],
      ] as const;

      this.createGeometricAnchors(config, positionConfigs.map(c => [...c]), 'position');
      this.createGeometricAnchors(config, movementConfigs.map(c => [...c]), 'movement');
  
      return this.anchors;
    }
  }