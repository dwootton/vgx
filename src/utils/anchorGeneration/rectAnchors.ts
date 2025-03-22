import { createAnchorProxy } from "../../utils/anchorProxy";
import { BaseComponent } from "../../components/base";
import {  AnchorOrGroupSchema, AnchorType, ChannelType } from "../../types/anchors";
export function getGenericAnchorTypeFromId(encoding: string): AnchorType {

    const channelMap: Record<string, AnchorType> = {
        "x": AnchorType.X,
        "y": AnchorType.Y,
        "x1": AnchorType.X,
        "y1": AnchorType.Y,
        "x2": AnchorType.X,
        "y2": AnchorType.Y,
        "color": AnchorType.COLOR,
        "size": AnchorType.SIZE,
        "shape": AnchorType.SHAPE,
        "text": AnchorType.TEXT,
        "data": AnchorType.DATA
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
    
    // Individual coordinate anchors
    ['x1', 'x2', 'y1', 'y2'].forEach(coord => {
        anchors.set(coord, {
            id: coord,
            type: 'encoding',
            channel: getGenericAnchorTypeFromId(coord),
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

    // anchors.set('markname', {
    //     id: 'markname',
    //     type: 'info',  // TODO fix this to be a non encoding anchor
    //     children: ['markname'],
    //     interactive: true
    // });

    function generateProxyFromSchema(schema: AnchorOrGroupSchema, component: BaseComponent, metaContext: any = {}) {
        // compile functions turn the proxy anchor into a compiled anchor (like {fieldValue:#, scaleName:'x'....})
        
        const compileFn = (nodeId?: string) => {
            // at this point, I'll want the super node resolution to occur at the bindingGraph level vs. at the compile time. 
            // 
            nodeId = nodeId || component.id;
           
             // get the bindingGraph
             // check to see if nodeId is in superNodes, if so, then get the superNodeId, else use nodeId
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
    // Convert Map to array of entries before using forEach
    Array.from(anchors.entries()).forEach(([key, schema]) => {
        const proxy = generateProxyFromSchema(schema, component);
        proxies.set(key, proxy);
    });
    return proxies;
}
