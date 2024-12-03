import { BaseComponent } from "../components/base";
import { Point } from "../types/geometry";
import { AnchorOrGroupSchema } from "../types/anchors";

export interface PointAnchorConfig {
    x: number;
    y: number;
}

export class PointAnchors {
    private component: BaseComponent;
    constructor(component: BaseComponent) {
        this.component = component;
    }

    protected anchors: Map<string, AnchorOrGroupSchema> = new Map();

   

    initializePointAnchors(providedConfig?: PointAnchorConfig) {
        const config = providedConfig || { x: 0, y: 0 };

        // Define anchor configurations
        const pointConfigs = [
            ['center', (c: PointAnchorConfig) => ({ x: c.x, y: c.y })],
        ] as const;
        
        this.anchors.set('center', {
            id: 'center',
            type: 'geometric',
            geometry: { x: config.x, y: config.y } as Point 
        });

        this.anchors.set('x', {
            id: 'x',
            type: 'encoding',
            channel: 'x',
        });

        this.anchors.set('y', {
            id: 'y',
            type: 'encoding',
            channel: 'y',
        });


        return this.anchors;
    }
}