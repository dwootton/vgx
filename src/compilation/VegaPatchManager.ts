import { TopLevelSpec } from "vega-lite/build/src/spec";
import { extractModifiedObjects, removeUndefinedInSpec, fixVegaSpanBug, removeUnreferencedParams } from "./patchingUtils";
import * as vl from "vega-lite";

import * as vega from 'vega';
import { codegenExpression, parseExpression } from "vega";
import { extractAllNodeNames } from "../components/utils";

const createBaseSignals = (params: any[]) => {
    const baseSignals: any[] = [];

    // Find all params that might reference base_ signals
    const paramsStr = JSON.stringify(params);
    const baseMatches = paramsStr.match(/base_[a-zA-Z0-9_]+/g) || [];
    const uniqueBaseSignals = [...new Set(baseMatches)];

    // Create base signals for each unique match
    uniqueBaseSignals.forEach(baseSignalName => {
        // Find the original param if it exists
        const originalParam = params.find(p => p.name === baseSignalName.replace('base_', ''));
        // Create a new base signal with minimal properties
        const baseSignal: any = {
            name: baseSignalName,
            value: originalParam?.value || null,
            // on: originalParam?.on || null,
            init: originalParam?.update || null
        };


        baseSignals.push(baseSignal);
    });

    return baseSignals;
}

export class VegaPatchManager {
    private spec: TopLevelSpec;
    private modifiedElements: { data: any[], params: any[], scales: any[] };
    constructor(spec: TopLevelSpec) {
        this.spec = spec;





        const baseSignals = createBaseSignals(spec.params || []);
        // Add base signals to spec.params if they have values
        if (baseSignals.length > 0) {
            // Initialize params array if it doesn't exist
            if (!spec.params) {
                spec.params = [];
            }

            // Add each base signal with a value to the params
            baseSignals.forEach(baseSignal => {
                // if (baseSignal.value !== null && baseSignal.value !== undefined) {
                spec.params.push(baseSignal);
                // }
            });
        }


        const undefinedRemoved = removeUndefinedInSpec(spec);


        // const unreferencedRemovedFirst = removeUnreferencedParams(undefinedRemoved);
        const unreferencedRemoved = removeUnreferencedParams(undefinedRemoved);


        this.modifiedElements = extractModifiedObjects(unreferencedRemoved);


        let resolvedParams = resolveCyclesCompletePipeline(unreferencedRemoved.params || []);

        // Convert top-level 'update' to 'init' and remove 'value: null'
        resolvedParams = resolvedParams.map(signal => {
            const modifiedSignal = { ...signal };

            // If signal has an update property at the top level, convert it to init
            if (modifiedSignal.update !== undefined) {
                modifiedSignal.init = modifiedSignal.update;
                delete modifiedSignal.update;
            }

            // Remove value: null properties
            if (modifiedSignal.value === null) {
                delete modifiedSignal.value;
            }

            return modifiedSignal;
        });

        const newParams = fixVegaSpanBug(resolvedParams)
        unreferencedRemoved.params = newParams


        // add reference to dataset
        if (this.modifiedElements.data.length > 0) {
            unreferencedRemoved.datasets = unreferencedRemoved.datasets || {}
            this.modifiedElements.data.forEach(dataset => {
                unreferencedRemoved.datasets[dataset.name] = []
            })
        }
        // console.log

        this.spec = unreferencedRemoved;


    }

    public compile() {
        console.log('compile vl2', this.spec)
        const vegaCompilation = vl.compile(this.spec);
        vegaCompilation.spec.padding = 40;




        // Update data elements that match modified elements
        if (vegaCompilation.spec.data && this.modifiedElements.data && Array.isArray(this.modifiedElements.data) && this.modifiedElements.data.length > 0) {

            vegaCompilation.spec.data = vegaCompilation.spec.data.map(dataElement => {
                const matchingModifiedData = this.modifiedElements.data.find(
                    modifiedData => modifiedData.name === dataElement.name
                );



                if (matchingModifiedData) {
                    return matchingModifiedData;
                }

                return dataElement;
            });

            // Move modified elements to the last position in the array
            vegaCompilation.spec.data.sort((a, b) => {
                const aIsModified = this.modifiedElements.data.some(d => d.name === a.name);
                const bIsModified = this.modifiedElements.data.some(d => d.name === b.name);
                if (aIsModified && !bIsModified) return 1;
                if (!aIsModified && bIsModified) return -1;
                return 0;
            });
        }


        // Update signals that match modified params
        if (vegaCompilation.spec.signals && this.modifiedElements.params.length > 0) {
            vegaCompilation.spec.signals = vegaCompilation.spec.signals.map(signal => {
                const matchingParam = this.modifiedElements.params.find(
                    param => param.name === signal.name
                );

                if (matchingParam && matchingParam.on && signal.on) {
                    // Create a new signal with merged 'on' arrays
                    return {
                        ...signal,
                        on: [...signal.on, ...matchingParam.on]
                    };
                }

                return signal;
            });
        }




        return vegaCompilation;
    }

}


function findMinimalCycles(params: VegaSignal[]): string[][] {
    // Build dependency graph
    const graph = new Map<string, Set<string>>();

    // Helper to extract signal names from expression
    const extractDependencies = (expr: string): string[] => {
        const signalPattern = /[a-zA-Z_][a-zA-Z0-9_]*/g;
        const matches = expr.match(signalPattern) || [];
        return matches.filter(name => name !== 'datum' && name !== 'event');
    };

    // Build graph
    params.forEach(param => {
        const dependencies = new Set<string>();

        // Add dependencies from update expression
        if (param.update) {
            extractDependencies(param.update).forEach(dep => dependencies.add(dep));
        }

        // Add dependencies from on events
        param.on?.forEach(event => {
            if (Array.isArray(event.events)) {
                event.events.forEach(e => {
                    if (typeof e.signal === 'string') {
                        dependencies.add(e.signal);
                    }
                });
            }
            extractDependencies(event.update).forEach(dep => dependencies.add(dep));
        });

        graph.set(param.name, dependencies);
    });

    // Tarjan's algorithm to find strongly connected components
    const index = new Map<string, number>();
    const lowlink = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    const cycles: string[][] = [];
    let currentIndex = 0;

    function strongConnect(node: string): void {
        index.set(node, currentIndex);
        lowlink.set(node, currentIndex);
        currentIndex++;
        stack.push(node);
        onStack.add(node);

        const neighbors = graph.get(node) || new Set();
        neighbors.forEach(neighbor => {
            if (!index.has(neighbor)) {
                strongConnect(neighbor);
                lowlink.set(node, Math.min(lowlink.get(node)!, lowlink.get(neighbor)!));
            } else if (onStack.has(neighbor)) {
                lowlink.set(node, Math.min(lowlink.get(node)!, index.get(neighbor)!));
            }
        });

        if (lowlink.get(node) === index.get(node)) {
            const cycle: string[] = [];
            let w: string;
            do {
                w = stack.pop()!;
                onStack.delete(w);
                cycle.push(w);
            } while (w !== node);

            // Only include cycles with more than one node
            if (cycle.length > 1) {
                cycles.push(cycle);
            }
        }
    }

    // Find all cycles
    graph.forEach((_, node) => {
        if (!index.has(node)) {
            strongConnect(node);
        }
    });

    // Filter to get minimal cycles
    const minimalCycles: string[][] = [];
    const seenNodes = new Set<string>();

    // Sort cycles by size (smallest first)
    cycles.sort((a, b) => a.length - b.length);

    cycles.forEach(cycle => {
        // Check if this cycle introduces any new nodes
        if (!cycle.every(node => seenNodes.has(node))) {
            minimalCycles.push(cycle);
            cycle.forEach(node => seenNodes.add(node));
        }
    });

    // Group cycles by channel (x or y)
    const channelCycles = new Map<string, string[][]>();
    minimalCycles.forEach(cycle => {
        // Determine channel based on signal names
        const channel = cycle[0].includes('_x') ? 'x' : 'y';
        if (!channelCycles.has(channel)) {
            channelCycles.set(channel, []);
        }
        channelCycles.get(channel)?.push(cycle);
    });

    // Select up to 2 cycles per channel
    const finalCycles: string[][] = [];
    channelCycles.forEach((cycles, channel) => {
        finalCycles.push(...cycles.slice(0, 2));
    });

    return finalCycles;
}




function organizeCyclesByType(cycles: string[][]): { [type: string]: string[][] } {
    const cyclesByType: { [type: string]: string[][] } = {
        start: [],
        stop: [],
        set: [],
        scalar: []
    };

    cycles.forEach(cycle => {
        // Determine the type of each signal in the cycle
        const types = new Set<string>();

        cycle.forEach(signal => {
            if (signal.includes('_start')) {
                types.add('start');
            } else if (signal.includes('_stop')) {
                types.add('stop');
            } else if (signal.includes('_set')) {
                types.add('set');
            } else {
                types.add('scalar');
            }
        });

        // If cycle contains only one type, add it to that type's array
        if (types.size === 1) {
            const type = Array.from(types)[0];
            cyclesByType[type].push(cycle);
        } else {
            // If cycle contains multiple types, split it by type
            const cyclesBySignalType: { [type: string]: string[] } = {
                start: [],
                stop: [],
                set: [],
                scalar: []
            };

            cycle.forEach(signal => {
                if (signal.includes('_start')) {
                    cyclesBySignalType.start.push(signal);
                } else if (signal.includes('_stop')) {
                    cyclesBySignalType.stop.push(signal);
                } else if (signal.includes('_set')) {
                    cyclesBySignalType.set.push(signal);
                } else {
                    cyclesBySignalType.scalar.push(signal);
                }
            });

            // Add non-empty arrays to their respective type groups
            Object.entries(cyclesBySignalType).forEach(([type, signals]) => {
                if (signals.length > 1) { // Only add if there are at least 2 signals (to form a cycle)
                    cyclesByType[type].push(signals);
                }
            });
        }
    });

    return cyclesByType;
}
/**
 * Complete pipeline to resolve signal cycles
 * @param params Original Vega signals
 * @returns Transformed signals with cycles resolved
 */
function resolveCyclesCompletePipeline(params: VegaSignal[]): VegaSignal[] {
    // Step 1: Find minimal cycles
    const cycles = findMinimalCycles(params);

    // Step 2: Organize cycles by type (start, stop, etc.)
    const cyclesByType = organizeCyclesByType(cycles);
    console.log('cyclesByType', cyclesByType);

    // Step 3: Merge and rewire cycles with constraint extraction
    // Iterate up to 10 times or until no more cycles are found
    let resolvedSignals = [...params];
    let iterationCount = 0;
    const maxIterations = 10;

    while (iterationCount < maxIterations) {
        // Find remaining cycles
        const remainingCycles = findMinimalCycles(resolvedSignals);

        // If no more cycles, we're done
        if (remainingCycles.length === 0) {
            console.log(`Resolved all cycles in ${iterationCount} iterations`);
            break;
        }

        // Organize remaining cycles by type
        const remainingCyclesByType = organizeCyclesByType(remainingCycles);
        console.log(`Iteration ${iterationCount + 1}, remaining cycles:`, remainingCyclesByType, JSON.parse(JSON.stringify(resolvedSignals)));

        // Apply constraint extraction and rewiring
        resolvedSignals = mergeAndRewireWithConstraints(resolvedSignals, remainingCyclesByType);

        iterationCount++;
    }

    if (iterationCount === maxIterations) {
        console.warn(`Reached maximum iterations (${maxIterations}) without fully resolving cycles`);
    }

    console.log('Final resolvedSignals', resolvedSignals);

    return resolvedSignals;
}

// /**
//  * Organize cycles by their type (start, stop, scalar, set)
//  */
// function organizeCyclesByType(cycles: string[][]): { [key: string]: string[][] } {
//     const cyclesByType: { [key: string]: string[][] } = {
//         start: [],
//         stop: [],
//         scalar: [],
//         set: []
//     };

//     cycles.forEach(cycle => {
//         // Determine cycle type based on signal names
//         if (cycle[0].includes('_start_')) {
//             cyclesByType.start.push(cycle);
//         } else if (cycle[0].includes('_stop_')) {
//             cyclesByType.stop.push(cycle);
//         } else if (cycle[0].includes('_set_')) {
//             cyclesByType.set.push(cycle);
//         } else {
//             cyclesByType.scalar.push(cycle);
//         }
//     });

//     return cyclesByType;
// }

/**
 * Enhanced version of mergeAndRewire that correctly handles constraints and events
 */
function mergeAndRewireWithConstraints(params: VegaSignal[], cyclesByType: { [key: string]: string[][] }): VegaSignal[] {
    const resolvedSignals: VegaSignal[] = [...params];

    // Helper functions
    const createInternalName = (name: string) => `${name}_internal`;
    const createMergedName = (names: string[]) => `${names.join('_')}_MERGED`;

    // Extract all signal names from an expression
    function extractSignalNames(expr: string): string[] {
        return extractAllNodeNames(expr);
    }

    // Process each cycle type
    Object.entries(cyclesByType).forEach(([type, cycles]) => {
        cycles.forEach(cycle => {
            // Step 1: Identify all signals in the cycle
            const cycleSignalSet = new Set(cycle);

            // Step 2: Extract constraints and base values
            const extracted = new Map<string, {
                baseValue: string,
                constraints: string[],
                referencedSignals: string[]
            }>();

            cycle.forEach(signalName => {
                const originalSignal = resolvedSignals.find(s => s.name === signalName);
                if (!originalSignal || !originalSignal.update) return;

                // Parse the signal's update expression
                const update = originalSignal.update;
                const ast = vega.parseExpression(update);

                // Extract base value and constraints
                const { baseValue, constraints } = extractConstraintsForCycle(ast, cycle);

                // Extract all signal names referenced in the base value
                const referencedSignals = extractSignalNames(baseValue);

                extracted.set(signalName, { baseValue, constraints, referencedSignals });
            });

            // Step 3: Create internal signals with base values and proper events
            cycle.forEach(signalName => {
                const originalSignal = resolvedSignals.find(s => s.name === signalName);
                if (!originalSignal) return;

                const extraction = extracted.get(signalName);
                const baseValue = extraction?.baseValue || originalSignal.update;

                // Extract all signal references from the base value for events
                const referencedSignals = extraction?.referencedSignals || [];

                // Create events array for the internal signal
                const events = referencedSignals.map(refSignal => ({ signal: refSignal }));

                const internalSignal = {
                    ...originalSignal,
                    name: createInternalName(signalName),
                    update: baseValue,
                    // Include on events if we have referenced signals
                    on: events.length > 0 ? [{
                        events: events,
                        update: baseValue
                    }] : undefined
                };

                resolvedSignals.push(internalSignal);
            });

            // Step 4: Create merged signal with constrainted updates
            const mergedName = createMergedName(cycle);

            // Choosing higher signals gets signal values that are likely to be plots
            function getInitSignal(cycle: string[]): string {
                // Find signal with highest number to use as init
                let highestNumberSignal = cycle[0];
                let highestNumber = -1;

                cycle.forEach(signalName => {
                    const matches = signalName.match(/\d+/g);
                    if (matches) {
                        const maxNumber = Math.max(...matches.map(Number));
                        if (maxNumber > highestNumber) {
                            highestNumber = maxNumber;
                            highestNumberSignal = signalName;
                        }
                    }
                });
                return highestNumberSignal;
            }
            const highestNumberSignal = getInitSignal(cycle);

            const initSignal = createInternalName(highestNumberSignal);
            const initValue = initSignal;//createInternalName(cycle[0]) 

            const mergedSignal: VegaSignal = {
                name: mergedName,
                value: null,
                init: initValue,
                on: cycle.map(signalName => {
                    const internalName = createInternalName(signalName);

                    // Collect constraints from all OTHER signals in the cycle
                    const appliedConstraints: string[] = [];
                    cycle.forEach(otherName => {
                        if (otherName !== signalName) {
                            const otherExtractions = extracted.get(otherName);
                            if (otherExtractions?.constraints) {
                                appliedConstraints.push(...otherExtractions.constraints);
                            }
                        }
                    });

                    // Apply all constraints to this internal signal's update
                    let update = internalName;
                    appliedConstraints.forEach(constraint => {
                        update = constraint.replace(/INSERT/g, update);
                    });

                    return {
                        events: [{ signal: internalName }],
                        update: update
                    };
                })
            };
            resolvedSignals.push(mergedSignal);

            // Step 5: Update original signals to reference the merged signal
            cycle.forEach(signalName => {
                const originalSignal = resolvedSignals.find(s => s.name === signalName);
                if (originalSignal) {
                    // Remove update statement
                    delete originalSignal.update;

                    // Clear existing on events and replace with merged signal reference
                    originalSignal.on = [
                        {
                            events: { signal: mergedName },
                            update: mergedName
                        }
                    ];
                }
            });

            // Step 6: Update all signals that reference cycle signals
            resolvedSignals.forEach(signal => {
                // Skip signals in the cycle
                if (cycle.includes(signal.name)) return;

                // Update expressions that reference cycle signals
                if (signal.update) {
                    cycle.forEach(cycleName => {
                        signal.update = signal.update!.replace(
                            new RegExp(`\\b${cycleName}\\b`, 'g'),
                            mergedName
                        );
                    });
                }

                // Update on events
                signal.on?.forEach(event => {
                    if (event.update) {
                        cycle.forEach(cycleName => {
                            event.update = event.update.replace(
                                new RegExp(`\\b${cycleName}\\b`, 'g'),
                                mergedName
                            );
                        });
                    }

                    // Update event signals as well
                    if (Array.isArray(event.events)) {
                        event.events.forEach(e => {
                            if (e.signal && cycle.includes(e.signal)) {
                                e.signal = mergedName;
                            }
                        });
                    } else if (event.events?.signal && cycle.includes(event.events.signal)) {
                        event.events.signal = mergedName;
                    }
                });
            });
        });
    });

    return resolvedSignals;
}

/**
 * Extract constraints and base value from an expression AST, specifically for cycle resolution
 */
function extractConstraintsForCycle(ast: any, cycleSignals: string[]): {
    baseValue: string,
    constraints: string[]
} {
    const constraints: string[] = [];
    let baseValue = '';

    // Function to check if expression contains any cycle signals
    function containsCycleSignal(expr: string): boolean {
        return cycleSignals.some(signal => expr.includes(signal));
    }

    // Function to extract constraints and base value from AST
    function processNode(node: any): string {
        if (node.type === 'CallExpression' && node.callee.name === 'clamp') {
            const args = node.arguments.map(arg => processNode(arg));
            const fullExpr = `clamp(${args.join(', ')})`;

            // If any arguments (other than the first) contain cycle signals,
            // this is part of the cycle and we extract the base value
            const hasSignalInBounds = args.slice(1).some(arg => containsCycleSignal(arg));
            if (hasSignalInBounds) {
                // The first argument is our base value
                baseValue = args[0];
                return baseValue;
            } else {
                // This is a regular constraint that we should preserve
                constraints.push(`clamp(INSERT, ${args[1]}, ${args[2]})`);
                return fullExpr;
            }
        } else if (node.type === 'CallExpression') {
            // Handle other function calls
            const args = node.arguments.map(arg => processNode(arg));
            return `${node.callee.name}(${args.join(', ')})`;
        } else if (node.type === 'BinaryExpression') {
            // Handle binary expressions (e.g., a + b)
            const left = processNode(node.left);
            const right = processNode(node.right);
            return `${left} ${node.operator} ${right}`;
        } else if (node.type === 'Identifier') {
            // Handle identifiers (e.g., variable names)
            return node.name;
        } else if (node.type === 'Literal') {
            // Handle literals (e.g., numbers, strings)
            return node.value.toString();
        } else if (node.type === 'MemberExpression') {
            // Handle member expressions (e.g., obj.prop)
            const object = processNode(node.object);
            const property = node.property.name || node.property.value;
            return `${object}.${property}`;
        } else {
            // Default case
            return node.toString();
        }
    }

    baseValue = processNode(ast);

    // If no base value was found but we have an AST, use the entire expression
    if (!baseValue && ast) {
        try {
            baseValue = vega.expressionFunction(ast)();
        } catch (e) {
            // If serialization fails, just use string representation
            baseValue = ast.toString();
        }
    }

    return { baseValue, constraints };
}