import { createAnchorProxy } from "../../utils/anchorProxy";
import { BaseComponent } from "../../components/base";
import {  AnchorOrGroupSchema, ChannelType } from "../../types/anchors";

function getChannelFromEncoding(encoding: string): ChannelType {

    const channelMap: Record<string, ChannelType> = {
        "x1": "x",
        "y1": "y",
        "x2": "x",
        "y2": "y",
        "color": "color",
        "size": "size",
        "shape": "shape"    
    }
    
    return channelMap[encoding]
}

type RectAnchorConfig = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
};

import { AnchorProxy } from "../../types/anchors";
export function generateRectAnchors(component: BaseComponent): Map<string, AnchorProxy>{
    const anchors = new Map<string, AnchorOrGroupSchema>();
    console.log('in generateRectAnchors', component);
    
    // Individual coordinate anchors
    ['x1', 'x2', 'y1', 'y2'].forEach(coord => {
        anchors.set(coord, {
            id: coord,
            type: 'encoding',
            channel: getChannelFromEncoding(coord),
            interactive: false
        });
    });

    // X/Y Group anchors
    anchors.set('x', {
        id: 'x',
        type: 'group',
        children: ['x1', 'x2'],
        interactive: true
    });

    anchors.set('y', {
        id: 'y',
        type: 'group', 
        children: ['y1', 'y2'],
        interactive: true
    });

    function generateProxyFromSchema(schema: AnchorOrGroupSchema, component: BaseComponent, metaContext: any = {}) {
        // compile functions turn the proxy anchor into a compiled anchor (like {fieldValue:#, scaleName:'x'....})
        
        const compileFn = (nodeId?: string) => {
          if (!nodeId) {
            nodeId = component.id
          }
            let value =  {fieldValue:`${(nodeId)}.${schema.id}`};
            return {source:'generated',value}
          
        }
        return createAnchorProxy(component, schema,compileFn );
      }

    // // Additional geometric anchors (sides, corners)
    // const sideAnchors = [
    //     { id: 'top', type: 'line', coordinates: { x1: config.x1, y1: config.y1, x2: config.x2, y2: config.y1 } },
    //     { id: 'bottom', type: 'line', coordinates: { x1: config.x1, y1: config.y2, x2: config.x2, y2: config.y2 } },
    //     { id: 'left', type: 'line', coordinates: { x1: config.x1, y1: config.y1, x2: config.x1, y2: config.y2 } },
    //     { id: 'right', type: 'line', coordinates: { x1: config.x2, y1: config.y1, x2: config.x2, y2: config.y2 } }
    // // ];

    // sideAnchors.forEach(anchor => {
    //     anchors.set(anchor.id, {
    //         ...anchor,
    //         interactive: true,
    //         subType: 'side'
    //     });
    // });

    const proxies = new Map<string, AnchorProxy>();
    console.log('anchors', anchors);
    // Convert Map to array of entries before using forEach
    Array.from(anchors.entries()).forEach(([key, schema]) => {
        console.log('in map', key, schema);
        const proxy = generateProxyFromSchema(schema, component);
        console.log('proxy', proxy);
        proxies.set(key, proxy);
    });
    return proxies;
}
