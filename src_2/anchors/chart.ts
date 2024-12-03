import { BaseComponent } from "../components/base";
import { AnchorOrGroupSchema, AnchorSchema } from "../types/anchors";
import { ChartSpec } from "../components/charts/base";
import { ChartConfig } from "components/charts/base";

export class ChartAnchors {
    private component: BaseComponent;
    protected anchors: Map<string, AnchorOrGroupSchema> = new Map();

    constructor(component: BaseComponent) {
        this.component = component;
    }

   

    private createPlotAnchor() {
        this.anchors.set('plot', {
            id: 'plot',
            type: 'geometric',
            geometry: {
                type: 'area',
                x1: 0,
                x2: 100,
                y1: 0,
                y2: 100,
            },
        });
    }

   

    initializeChartAnchors(spec: ChartSpec) {
        // Initialize base anchors
        this.createPlotAnchor();
        // Create groups for further organization
        const positionEncodings = new Map<string, AnchorOrGroupSchema>();
        const valueEncodings = new Map<string, AnchorOrGroupSchema>();

        this.anchors.forEach((anchor, channel) => {
            if (channel === 'x' || channel === 'y') {
                positionEncodings.set(channel, anchor);
            } else if (channel === 'color' || channel === 'size' || channel === 'shape') {
                valueEncodings.set(channel, anchor);
            }
        });

        if (positionEncodings.size > 0) {
            this.anchors.set('position', {
                id: 'position',
                type: 'group',
                children: positionEncodings as Map<string, AnchorSchema>
            });
        }

        if (valueEncodings.size > 0) {
            this.anchors.set('value', {
                id: 'value',
                type: 'group',
                children: valueEncodings as Map<string, AnchorSchema>
            });
        }

        return this.anchors;
    }
}
