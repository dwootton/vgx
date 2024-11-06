import { BaseComponent } from "../components/base";
import { Point, Line } from "../types/geometry";
import { AnchorOrGroup } from "../types/anchors";

export interface RectAnchorConfig {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }
  
export class RectAnchors {

    private component: BaseComponent;
    constructor(component: BaseComponent) {
        this.component = component;
    }

   
    protected anchors: Map<string, AnchorOrGroup> = new Map();
  
    private createGeometricAnchors(
      config: RectAnchorConfig,
      anchorConfigs: Array<[string, (c: RectAnchorConfig) => any]>,
      groupName: string
    ) {
      // Create individual anchors
      anchorConfigs.forEach(([name, getGeometry]) => {
        this.anchors.set(name, {
          id: this.component.generateAnchorId(name),
          type: 'geometric',
          geometry: getGeometry(config),
          bind: this.component.createAnchorProxy(name)
        });
      });
  
      // Create group
      this.anchors.set(groupName, {
        id: this.component.generateAnchorId(groupName),
        type: 'group',
        children: new Map(anchorConfigs.map(([name]) => {
            const anchor = this.anchors.get(name);
            if (!anchor) throw new Error(`Anchor "${name}" not found`);
            if ('type' in anchor && anchor.type === 'group') throw new Error(`Nested groups are not allowed: "${name}"`);
            return [name, anchor];
          })),
        bind: this.component.createGroupProxy(groupName)
      });
    }
  
    initializeRectAnchors(config: RectAnchorConfig) {
      const { x1, y1, x2, y2 } = config;
  
      // Define anchor configurations
      const sideConfigs = [
        ['top', (c: RectAnchorConfig) => ({ x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y1 })],
        ['bottom', (c: RectAnchorConfig) => ({ x1: c.x1, y1: c.y2, x2: c.x2, y2: c.y2 })],
        ['left', (c: RectAnchorConfig) => ({ x1: c.x1, y1: c.y1, x2: c.x1, y2: c.y2 })],
        ['right', (c: RectAnchorConfig) => ({ x1: c.x2, y1: c.y1, x2: c.x2, y2: c.y2 })]
      ] as const;
  
      const cornerConfigs = [
        ['topLeft', (c: RectAnchorConfig) => ({ x: c.x1, y: c.y1 })],
        ['topRight', (c: RectAnchorConfig) => ({ x: c.x2, y: c.y1 })],
        ['bottomLeft', (c: RectAnchorConfig) => ({ x: c.x1, y: c.y2 })],
        ['bottomRight', (c: RectAnchorConfig) => ({ x: c.x2, y: c.y2 })]
      ] as const;
  
      const xConfigs = [
        ['x1', (c: RectAnchorConfig) => ({ x1: c.x1 , x2: c.x1, y1: c.y1 ,y2: c.y2 })],
        ['x2', (c: RectAnchorConfig) => ({ x1: c.x2, x2:c.x2 ,y1: c.y1 ,y2: c.y2 })],
      ] as const;

      // Create all anchors
      this.createGeometricAnchors(config, xConfigs.map(c => [...c]), 'x');
      this.createGeometricAnchors(config, sideConfigs.map(c => [...c]), 'sides');
      this.createGeometricAnchors(config, cornerConfigs.map(c => [...c]), 'corners');
  
      return this.anchors;
    }
  }