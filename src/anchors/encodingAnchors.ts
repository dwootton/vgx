// src/components/anchors/encoding.ts
import { BaseComponent } from "../components/base";
import { AnchorOrGroup,Anchor } from "../types/anchors";
import { ChartSpec } from "../components/charts/base";
import { Encoding } from 'vega-lite/build/src/encoding';
import { Field } from 'vega-lite/build/src/channeldef';
import { ChartConfig } from "components/charts/base";

export class EncodingAnchors {
    private component: BaseComponent;
    protected anchors: Map<string, AnchorOrGroup> = new Map();

    constructor(component: BaseComponent) {
        this.component = component;
    }

    private createEncodingAnchor(
        channel: string,
        encoding: any  // Could type this more specifically with Vega-Lite types
    ) {
        this.anchors.set(channel, {
            id: (channel),
            type: 'encoding',
            channel,
        });
    }

    initializeEncodingAnchors(spec: ChartSpec) {
        // Handle each encoding channel
        if (spec.encoding) {
            Object.entries(spec.encoding).forEach(([channel, encoding]) => {
                this.createEncodingAnchor(channel, encoding);
            });
        }

        // Create groups based on encoding type
        const positionEncodings = new Map<string, AnchorOrGroup>();
        const valueEncodings = new Map<string, AnchorOrGroup>();

        this.anchors.forEach((anchor, channel) => {
            if (channel === 'x' || channel === 'y') {
                positionEncodings.set(channel, anchor);
            } else if (channel === 'color' || channel === 'size' || channel === 'shape') {
                valueEncodings.set(channel, anchor);
            }
        });

        // Add groups if they have members
        if (positionEncodings.size > 0) {
            this.anchors.set('position', {
                id: ('position'),
                type: 'group',
                children: positionEncodings as Map<string, Anchor>
            });
        }

        if (valueEncodings.size > 0) {
            this.anchors.set('value', {
                id: ('value'),
                type: 'group',
                children: valueEncodings as Map<string, Anchor>
            });
        }

        return this.anchors;
    }
}
