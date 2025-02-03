import { BaseComponent } from "../components/base";
import { AnchorProxy } from "../types/anchors";
import { AnchorGroupSchema } from "../types/anchors";

// TODO: issue is that these bindings appear to be binding to weird source anchors (for example, )
// source nod2, target node 1 (rect->interval) and node2->node 0, bind.composite.child[0].... gotta figure that out
// probably some issue with the group unpacking, and its iterating over all exposed properties of the component.

export function createGroupAnchor(
    component: BaseComponent,
    groupName: string,
    childAnchorIds: string[],
    interactive: boolean = false
): AnchorProxy {
    const children = childAnchorIds.map(child => component.getAnchor(child));
    
    return {
        id: { componentId: component.id, anchorId: groupName },
        component,
        anchorSchema: {
            id: groupName,
            type: 'group',
            children: childAnchorIds,
            interactive
        } as AnchorGroupSchema,
        bind: (target: any) => {
            console.log('bind', target)
            children.forEach(child => {
                console.log('child', child)
                child?.bind(target)
            });
            console.log('component', component)
            return component;
        },
        compile: (nodeId?: string) => ({
            source: 'generated',
            value: children.reduce((acc, child) => ({
                ...acc,
                [child.id.anchorId]: child?.compile(nodeId)?.value
            }), {})
        })
    };
} 