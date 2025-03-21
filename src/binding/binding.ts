import { AnchorProxy, AnchorIdentifer, PositionValueSchema, ValueSchema } from "../types/anchors";
import { TopLevelSpec } from "vega-lite/build/src/spec";
import { BindingManager, Edge } from "./BindingManager";
export type compilationContext = any;

export function removeUnreferencedParams(spec: TopLevelSpec) {
    // Stringify the spec (omitting data) to search for parameter usage
const specString = JSON.stringify(spec, (key, value) => {
    // Skip data values to reduce size
    if (key === 'values' && Array.isArray(value)) {
        return '[...]';
    }
    return value;
});

// Check if each parameter is actually used in expressions
const usedParams = spec.params?.filter(param => {
    const paramName = param.name;
    if(paramName.includes('VGXMOD_')){
        return true;
    }
    // Look for the parameter name within expression strings
    // Match both 'paramName' and "paramName" patterns
    const singleQuotePattern = `'${paramName}'`;
    const doubleQuotePattern = `"${paramName}"`;
    
    // Also match direct references to the parameter in expressions
    const directRefPattern = new RegExp(`\\b${paramName}\\b`);
    
    // Count occurrences to ensure parameter is used at least twice
    const singleQuoteMatches = (specString.match(new RegExp(singleQuotePattern, 'g')) || []).length;
    const doubleQuoteMatches = (specString.match(new RegExp(doubleQuotePattern, 'g')) || []).length;
    // const directRefMatches = (specString.match(directRefPattern) || []).length;
    // console.log('directRefMatches', paramName, directRefMatches)
    
    const totalOccurrences = singleQuoteMatches + doubleQuoteMatches;// + directRefMatches;
    // console.log('directRefMatches total:', totalOccurrences, 'from:',directRefMatches, singleQuoteMatches, doubleQuoteMatches)
    return totalOccurrences >= 2;
}) || [];

return {
    ...spec,
    params: usedParams
}
}   
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
export const deduplicateById = (items: AnchorProxy[]): AnchorProxy[] => 
    items.filter((item, index, self) =>
        index === self.findIndex((t) => t.id.anchorId === item.id.anchorId && t.id.componentId === item.id.componentId)
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


export type EdgeResult = {
    data: { source: string; value: ValueSchema };
    type: AnchorIdentifer;
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

export const resolveAnchorValue = (edges: Edge[], nodeIdMap: Map<string, string>): PositionValueSchema | number | string => {
    
    const edgeResults = edges.map(edge => {
       
        if ('anchorProxy' in edge) {
            const anchor = edge.anchorProxy;
            
            const result = {
                data: anchor.compile(nodeIdMap.get(anchor.id.componentId)),
                type: anchor.anchorSchema.type
            };
            return result

        } else {
            // Handle virtual edge case
            return {
                data: {
                    source: edge.source,
                    value: edge.value
                },
                type: 'virtual' as AnchorIdentifer
            };
        }
    });


    const prioritizedValue = getPrioritizedValue(edgeResults);
    return prioritizedValue;
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


import { BindingEdge } from "./BindingManager";

export const detectBidirectionalLinks = (edges: BindingEdge[]): Map<string, string> => {
    const bidirectionalPairs = new Map<string, string>();
  
    // Create a map to track edges for quick lookup
    const edgeMap = new Map<string, Set<string>>();
    for (const edge of edges) {
      const { source, target } = edge;
      if (!edgeMap.has(source.nodeId)) {
        edgeMap.set(source.nodeId, new Set());
      }
      edgeMap.get(source.nodeId)!.add(target.nodeId);
    }
  
    // Check for bidirectional links
    for (const [sourceId, targets] of edgeMap) {
      for (const targetId of targets) {
        if (edgeMap.get(targetId)?.has(sourceId)) {
          // Found a bidirectional link between sourceId and targetId
          bidirectionalPairs.set(sourceId, targetId);
          bidirectionalPairs.set(targetId, sourceId);
        }
      }
    }
  
    return bidirectionalPairs;
  };

  export const createSuperNodeMap = (bidirectionalPairs: Map<string, string>): Map<string, string> => {
    const superNodeMap = new Map<string, string>();
    const visited = new Set<string>();
  
    for (const [nodeId, pairedNodeId] of bidirectionalPairs) {
      if (!visited.has(nodeId)) {
        // Create a new super node ID
        const superNodeId = `super_${nodeId}`;
  
        // Map both nodes to the same super node
        superNodeMap.set(nodeId, superNodeId);
        superNodeMap.set(pairedNodeId, superNodeId);
  
        // Mark both nodes as visited
        visited.add(nodeId);
        visited.add(pairedNodeId);
      }
    }
  
    return superNodeMap;
  };

  export const detectAndMergeSuperNodes = (edges: BindingEdge[]): Map<string, string> => {
    // Step 1: Detect bidirectional links
    const bidirectionalPairs = detectBidirectionalLinks(edges);
  
    // Step 2: Merge bidirectional links into super nodes
    const superNodeMap = createSuperNodeMap(bidirectionalPairs);
  
    return superNodeMap;
  };