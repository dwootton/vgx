import { BaseComponent } from "../components/base";
import { AnchorProxy } from "../types/anchors";
import { AnchorGroupSchema } from "../types/anchors";

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
            children.forEach(child => 
                child?.bind(target)
            );
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