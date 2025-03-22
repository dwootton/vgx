

//Components: 

// creates the accessor for the signal backing the range
// export const createRangeAccessor = (id: string, channel: string) => {
//     return {
//         'start': `${id}.${channel}.start`,
//         'stop': `${id}.${channel}.stop`,
//     }
// }

export const createRangeAccessor = (id: string, channel: string) => {
        return {
            'start': `${id}_${channel}_start`,
            'stop': `${id}_${channel}_stop`,
        }
    }
    

export function generateCompiledValue(id: string, channel: string) {
    return  `${id}_${channel}` // min value
}

export function extractAllNodeNames(input: string): string[] {
    const nodeNames: string[] = [];

    // Find all node_X.something patterns (return just node_X)
    const dotPattern = /(node_\d+)\./g;
    let dotMatch;

    while ((dotMatch = dotPattern.exec(input)) !== null) {
        if (dotMatch[1] && !nodeNames.includes(dotMatch[1])) {
            nodeNames.push(dotMatch[1]);
        }
    }

    // Find all node_X_something patterns (return the whole thing)
    const underscorePattern = /\b(node_\d+(?:_[^,)\s.]+))\b/g;
    let underscoreMatch;

    while ((underscoreMatch = underscorePattern.exec(input)) !== null) {
        if (underscoreMatch[1] && !nodeNames.includes(underscoreMatch[1])) {
            nodeNames.push(underscoreMatch[1]);
        }
    }

    // Find merged node patterns like node_X_node_Y_merged
    const mergedNodePattern = /\b(merged_node_\d+_node_\d+(?:_[^,)\s.]+)?)\b/g;
    let mergedNodeMatch;

    while ((mergedNodeMatch = mergedNodePattern.exec(input)) !== null) {
        if (mergedNodeMatch[1] && !nodeNames.includes(mergedNodeMatch[1])) {
            nodeNames.push(mergedNodeMatch[1]);
        }
    }

    // Find any remaining bare node_X patterns that weren't caught above
    const barePattern = /\b(node_\d+)\b(?![\._])/g;
    let bareMatch;

    while ((bareMatch = barePattern.exec(input)) !== null) {
        if (bareMatch[1] && !nodeNames.includes(bareMatch[1])) {
            nodeNames.push(bareMatch[1]);
        }
    }

    return [...new Set(nodeNames)];
}
export const generateScalarSignalFromAnchor = (constraints: string[], anchorId: string, parentExtractor: string, mergedParent: string): any[] => {
    let channel = anchorId;

    // Check if any constraint is undefined or contains undefined
    if (constraints.some(constraint => constraint === undefined || constraint.includes('undefined'))) {
        console.warn(`Skipping signal generation for ${anchorId} due to undefined constraints`);
        return [];
    }
    
    const parentSignal = extractAllNodeNames(parentExtractor)[0];
    const signalName = mergedParent + '_' + channel;

    const generateConstraints = (update: string) => {
        return {
            events: [ extractAllNodeNames(update).map(node => ({
                signal: node
            }))],
            update: update.replace(/VGX_SIGNAL_NAME/g, signalName)
        }
    };

    const clampedExtractor = collapseSignalUpdates(constraints.map(generateConstraints), parentExtractor)
    const depedentNodes = extractAllNodeNames(clampedExtractor).filter(node => node !== signalName)

    return [{
        name: signalName,
        value: null,
        on: [{
            events: [{
                signal: parentSignal
            }, ...depedentNodes.map(node => ({
                signal: node
            }))],
            update: clampedExtractor
        }]
    }];
}

export const generateRangeSignalFromAnchor = (constraints: string[], anchorId: string, signalParent: string, mergedParent: string): any[] => {
    let channel = anchorId;

    // Check if any constraint is undefined or contains undefined
    if (constraints.some(constraint => constraint === undefined || constraint.includes('undefined'))) {
        console.warn(`Skipping signal generation for ${anchorId} due to undefined constraints`);
        return [];
    }
    
    const startSignalName = mergedParent + '_' + channel + '_start';
    const stopSignalName = mergedParent + '_' + channel + '_stop';

    const startParentExtractor = signalParent + "." + channel + ".start";
    const stopParentExtractor = signalParent + "." + channel + ".stop";

    const generateStartConstraints = (update: string) => {
        return {
            events: {
                signal: startSignalName
            },
            update: `${update.replace(/VGX_SIGNAL_NAME/g, startParentExtractor)}`
        }
    };

    const generateStopConstraints = (update: string) => {
        return {
            events: {
                signal: stopSignalName
            },
            update: `${update.replace(/VGX_SIGNAL_NAME/g, stopParentExtractor)}`
        }
    };

    const clampedStartExtractor = collapseSignalUpdates(constraints.map(generateStartConstraints), startParentExtractor)
    const clampedStopExtractor = collapseSignalUpdates(constraints.map(generateStopConstraints), stopParentExtractor)

    const depedentStartNodes = extractAllNodeNames(clampedStartExtractor)
    const depedentStopNodes = extractAllNodeNames(clampedStopExtractor)


    return [
        {
            name: startSignalName,
            on: [{
                events: [{
                    signal: signalParent
                }, ...depedentStartNodes.map(node => ({
                    signal: node
                }))],
                update: clampedStartExtractor
            }],
        },
        {
            name: stopSignalName,
            on: [{
                events: [{
                    signal: signalParent
                }, ...depedentStopNodes.map(node => ({
                    signal: node
                }))],
                update: clampedStopExtractor
            }],
        }
    ];
}
// Core types for the signal generation system
interface Transform {
    name?: string;      // Optional name for the generated signal
    channel: string;    // The channel this transform applies to (x, y, etc)
    value: string;      // Expression to extract value (e.g. "PARENT_ID.x.start")
  }
  
  interface SignalConfig {
    id: string;         // Parent/source component ID
    transform: Transform;  // How to extract the value
    output: string;     // Target signal name
    constraints: string[];  // Constraints to apply
  }
  
  /**
   * Core function to generate a Vega signal from a configuration
   */
  export function generateSignal(config: SignalConfig): any {
    const { id, transform, output, constraints } = config;
    
    // Skip if constraints are invalid
    if (constraints.some(c => c === undefined || c.includes('undefined'))) {
      console.warn(`Skipping signal generation for ${transform.channel} due to undefined constraints`);
      return null;
    }
    
    // Replace PARENT_ID in the transform value with the actual ID
    const parentExtractor = transform.value.replace(/PARENT_ID/g, id);
    
    // Process constraints
    const processedConstraints = constraints.map(constraint => ({
      events: extractAllNodeNames(constraint).map(node => ({ signal: node })),// TODO FIX DEPENDENCTS
      update: constraint.replace(/VGX_SIGNAL_NAME/g, parentExtractor)
    }));

    
    // Build the final update expression
    const finalUpdate = collapseSignalUpdates(processedConstraints, parentExtractor);
    // Find dependent nodes
    const dependentNodes = extractAllNodeNames(finalUpdate)
      .filter(node => node !== output)
      .map(node => ({ signal: node }));
    
       // ...dependentNodes] TODO FIX DEPENDENCTS
    const uniqueTriggerEvents = [...new Set(dependentNodes.map(JSON.stringify))].map(JSON.parse);
    // Return the signal definition
    return {
      name: output,
      value: null,
      on: [{
        events: uniqueTriggerEvents,
        update: finalUpdate
      }]
    };
  }
  
  /**
   * Generate signals from a collection of transforms
   * This simplifies the process of creating multiple related signals
   */
  export function generateSignalsFromTransforms(
    transforms: Transform[],
    parentId: string,
    outputPrefix: string,
    constraints: Record<string, string[]>,
  ): any[] {
    return transforms
      .map(transform => {
        const channel = transform.channel;
        if(channel ==='data'){
            return []
        }
        const outputName = `${outputPrefix}_${transform.name || channel}`;
        
        const signal = generateSignal({
          id: parentId,
          transform,
          output: outputName,
          constraints: constraints[channel] || [],
        });
        return signal
      })
      .filter(signal => signal !== null); // Remove any nulls from skipped signals
  }

  
export const generateSignalFromAnchor = (constraints: string[], anchorId: string, transform: string[], mergedParent: string, schemaType: string): any[] => {
    // For Scalar type
    if (schemaType === 'Scalar') {
        return generateScalarSignalFromAnchor(constraints, anchorId, transform[0], mergedParent);
    }
    // For Range type
    else if (schemaType === 'Range') {
        return generateRangeSignalFromAnchor(constraints, anchorId, transform, mergedParent);
    }

    // Default case (should not happen if schema is properly defined)
    console.warn(`Unknown schema type: ${schemaType} for channel ${anchorId}`);
    return [];
}

/**
 * Collapses an array of signal updates into a single Vega update string
 * by recursively replacing SIGNALVAL placeholders with the target value
 * 
 * @param updates Array of update objects with update strings
 * @param target The target signal value to replace SIGNALVAL with
 * @returns A single collapsed update string
 */
export function collapseSignalUpdates(updates: { update: string }[], target: string): string {
    if (!updates || updates.length === 0) {
        return "";
    }

    // For the target, wrap it in parentheses
    const formattedTarget = `(${target})`;

    // Start with the deepest nested update (last in the array)
    let result = updates[updates.length - 1].update;

    // Replace any SIGNALVAL in the deepest update with the formatted target
    if (result.includes("SIGNALVAL")) {
        result = result.replace(/SIGNALVAL/g, formattedTarget);
    }

    // Process remaining updates in reverse order (from deepest to shallowest)
    for (let i = updates.length - 2; i >= 0; i--) {
        const currentUpdate = updates[i].update;

        // Wrap the previous result in parentheses before substituting
        const wrappedResult = `(${result})`;

        // Replace SIGNALVAL with the wrapped result
        result = currentUpdate.replace("SIGNALVAL", wrappedResult);
    }

    return result;
}