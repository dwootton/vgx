import { AnchorProxy, AnchorType } from "../types/anchors";


export type compilationContext = any;

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


/**
 * Groups edges by their channel
 */
export const groupEdgesByChannel = (edges: AnchorProxy[]): Map<string, AnchorProxy[]> =>
    groupBy(edges, edge => edge.id.anchorId);

/**
 * Gets value based on priority: context > generated > baseContext
 */
const getPrioritizedValue = (
    edgeResults: Array<{ data: { source: string; value: string }, type: AnchorType }>
): string => {
    const contextData = edgeResults.find(result => 
        result.data.source === 'context');
    
    if (contextData) {
        return contextData.data.value;
    }

    const generatedData = edgeResults.filter(result => 
        !['context', 'baseContext'].includes(result.data.source));
    
    if (generatedData.length) {
        return generatedData
            .map(result => result.data.value)
            .join(',');
    }

    const baseContextData = edgeResults.find(result => 
        result.data.source === 'baseContext');
    
    return baseContextData?.data.value ?? '';
};

/**
 * Resolves the value for a channel based on priority rules
 */
export const resolveChannelValue = (edges: AnchorProxy[]): string => {
    const edgeResults = edges.map(edge => ({
        data: edge.compile(),
        type: edge.anchorSchema.type
    }));

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