import { AnchorProxy, AnchorType, PositionValueSchema, ValueSchema } from "../types/anchors";
import { TopLevelSpec } from "vega-lite/build/src/spec";
import { BindingManager } from "./BindingManager";
export type compilationContext = any;


export function removeUndefinedInSpec(obj: TopLevelSpec): TopLevelSpec {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => removeUndefinedInSpec(item)).filter(item => item !== undefined) as any;
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value === undefined) continue;

        const cleanValue = removeUndefinedInSpec(value);
        if (cleanValue !== undefined) {
            result[key] = cleanValue;
        }
    }
    return result;
}
/**
 * Deduplicates items based on their ID
 */
export const deduplicateById = <T extends { id: any }>(items: T[]): T[] => 
    items.filter((item, index, self) =>
        index === self.findIndex((t) => t.id === item.id)
    );

/**
 * Groups items by a specified key
 */
export const groupBy = <T>(items: T[], keyGetter: (item: T) => string): Map<string, T[]> =>
    items.reduce((groups, item) => {
        const key = keyGetter(item);
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)?.push(item);
        return groups;
    }, new Map<string, T[]>());
import { VirtualBindingEdge } from "./BindingManager";
type Edge = AnchorProxy | VirtualBindingEdge;
/**
 * Groups edges by their channel
 */
export const groupEdgesByChannel = (edges: AnchorProxy[]): Map<string, Edge[]> =>
    groupBy(edges, edge => edge.id.anchorId);


export type EdgeResult = {
    data: { source: string; value: ValueSchema };
    type: AnchorType;
  };

import { normalizeEdgeResult, resolveValueSchema } from "./channelResolution";
export const getPrioritizedValue = (
    edgeResults: EdgeResult[]
  ): PositionValueSchema | number | string => {
    // Normalize edge results (only for numeric encodings)
    const normalizedResults = edgeResults.map(normalizeEdgeResult);
  
    // Resolve the entire value schema
    const resolvedSchema = resolveValueSchema(normalizedResults);
    // if 

  
    // Otherwise, return the full resolved schema
    return resolvedSchema;
  };
  
/**
 * Resolves the value for a channel based on priority rules
 */
export const resolveChannelValue = (edges: Edge[]): PositionValueSchema | number | string => {
    const edgeResults = edges.map(edge => {
        if ('compile' in edge) {
            return {
                data: edge.compile(),
                type: edge.anchorSchema.type
            };
        } else {
            // Handle virtual edge case
            return {
                data: {
                    source: edge.source,
                    value: edge.value
                },
                type: 'virtual' as AnchorType
            };
        }
    });

    return getPrioritizedValue(edgeResults);
};

// utils/validationUtils.ts
/**
 * Validates component existence and throws appropriate error
 */
export const validateComponent = (component: any, nodeId: string): void => {
    if (!component) {
        throw new Error(`Component "${nodeId}" not added to binding manager`);
    }
};


/**
 * Logs component info for debugging
 */
export const logComponentInfo = (edges: Map<string, AnchorProxy[]>, bindingManager: BindingManager) => {
    edges.forEach((edgeList) => {
        (edgeList as AnchorProxy[]).forEach((edge) => {
            if (edge.id) {
                console.log('Component ID:', edge.component.id);
                const component = bindingManager.getComponent(edge.component.id);
                if (component) {
                    console.log('Component:', component);
                }
            }
        });
    });
};