

//Components: 

// creates the accessor for the signal backing the range
export const createRangeAccessor = (id: string, channel: string) => {
    return {
        'start': `${id}.${channel}.start`,
        'stop': `${id}.${channel}.stop`,
    }
}


export function generateCompiledValue(channel: string) {
    return {
        'value': `VGX_SIGNAL_NAME_${channel}`, // min value
    }
}
function extractAllNodeNames(input: string): string[] {
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

    // Find any remaining bare node_X patterns that weren't caught above
    const barePattern = /\b(node_\d+)\b(?![\._])/g;
    let bareMatch;

    while ((bareMatch = barePattern.exec(input)) !== null) {
        if (bareMatch[1] && !nodeNames.includes(bareMatch[1])) {
            nodeNames.push(bareMatch[1]);
        }
    }

    return nodeNames;
}

export const generateSignalFromAnchor = (constraints: string[], channel: string, signalParent: string, mergedParent: string, schemaType: string): any[] => {
    // For Scalar type
    if (schemaType === 'Scalar') {
        const parentExtractor = signalParent + "." + channel;
        const signalName = mergedParent + '_' + channel;

        const generateConstraints = (update: string) => {
            return {
                events: {
                    signal: signalName
                },
                update: update.replace(/VGX_SIGNAL_NAME/g, signalName)
            }
        };

        const clampedExtractor = collapseSignalUpdates(constraints.map(generateConstraints), parentExtractor)
        const depedentNodes = extractAllNodeNames(clampedExtractor)


        return [{
            name: signalName,
            value: null,
            on: [{
                events: [{
                    signal: signalParent
                }, ...depedentNodes.map(node => ({
                    signal: node
                }))],
                update: clampedExtractor
            }]
        }]

}

    // For Range type
    else if (schemaType === 'Range') {
    // if mergedParent has _channel_start or _channel_stop, remove it and then re add later
    // mergedParent = mergedParent.replace(`start_${channel}`, '').replace(`stop_${channel}`, '');
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
            //value: 1,
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
            //value: 400,
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

// Default case (should not happen if schema is properly defined)
console.warn(`Unknown schema type: ${schemaType} for channel ${channel}`);
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