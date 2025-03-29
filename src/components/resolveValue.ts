import { CompilationContext } from "../binding/binding";
import { areNamesCompatible, generateAnchorId,  } from "./utils";
import { compileConstraint, Constraint } from "../binding/constraints";
import { BindingEdge } from "../binding/GraphManager";
import { SchemaType } from "../types/anchors";
import { BaseComponent } from "./base";
import { isAnchorTypeCompatible } from "../binding/cycles";

// First, define our anchor types and their corresponding output structures
type AnchorTypeMapping = {
    'encoding': { expr: string };      // x, y, x1, x2, color, etc.
    'data': { name: string };          // data sources
    'markName': string;                // direct string for mark names
    'text': { expr: string };          // text content
};

// Define what types of anchors map to what output types
const anchorTypeCategories = {
    encoding: ['x', 'y', 'x1', 'x2', 'color', 'size', 'opacity'],
    data: ['data'],
    markName: ['markName'],
    text: ['text']
} as const;

// Pipeline stages
interface ValueResolutionContext {
    key: string;
    value: string;
    isDataContext: boolean;
    anchorCategory: keyof AnchorTypeMapping;
}

function resolveValue(key: string, inputContext: CompilationContext, signals: any[]): ValueResolutionContext {
    const dataContext = analyzeDataContext(inputContext);
    const value = findCompatibleValue(key, inputContext, signals);
    const anchorCategory = determineAnchorCategory(key);

    console.log('resolveValue', key, value, dataContext, signals)
    return {
        key,
        value,
        isDataContext: false,//dataContext.hasDataConstraints,
        anchorCategory
    };
}

interface SignalContext {
    name: string;
    usedInData?: boolean;
}

interface DataContext {
    hasDataConstraints: boolean;
    dataNodes: Set<string>;
}

function analyzeDataContext(inputContext: CompilationContext): DataContext {
    const dataNodes = new Set<string>();
    
    Object.entries(inputContext).forEach(([_, constraints]) => {
        if (!Array.isArray(constraints)) return;
        
        constraints.forEach(constraint => {
            if (constraint?.type === 'data') {
                const nodeId = constraint.triggerReference.split('_').slice(0, 2).join('_');
                dataNodes.add(nodeId);
            }
        });
    });

    return {
        hasDataConstraints: dataNodes.size > 0,
        dataNodes
    };
}

function findCompatibleValue(
    key: string, 
    inputContext: CompilationContext, 
    signals: any[]
): string | null {
    // 1. Check signals first
    const compatibleSignal = signals.find(signal => 
        areNamesCompatible(key, generateAnchorId(signal.name))
    );
    if (compatibleSignal) {
        return compatibleSignal.name;
    }

    // 2. Check input context for constraints
    const compatibleKeys = Object.keys(inputContext).filter(contextKey =>
        areNamesCompatible(key, contextKey)
    );

    if (compatibleKeys.length > 0) {
        const constraints = inputContext[compatibleKeys[0]];
        if (Array.isArray(constraints) && constraints.length > 0) {
            // Take the first valid constraint
            const constraint = constraints.find(c => c && (c.value || c.triggerReference));
            if (constraint) {
                return compileConstraint(constraint);
            }
        }
    }

    // 3. Handle special cases
    if (key === 'data') {
        return 'data';
    }

    // 4. No compatible value found
    return null;
}
function compileSignalReference(
    signal: SignalContext, 
    dataContext: DataContext, 
    key: string
): string {
    // For data key, return the name directly
    if (key === 'data') {
        return signal.name;
    }

    // For data context, wrap in datum[]
    const isUsedInData = dataContext.dataNodes.has(signal.name.split('_').slice(0, 2).join('_'));
    return isUsedInData ? `datum[${signal.name}]` : signal.name;
}

function formatValue({ value, isDataContext, anchorCategory, key }: ValueResolutionContext): any {
    // Don't wrap data values in datum[]
    if (anchorCategory === 'data') {
        return { name: value };
    }

    // For encodings, wrap in datum[] if in data context
    if (anchorCategory === 'encoding') {
        const exprValue = isDataContext ? `datum[${value}]` : value;
        return { expr: exprValue };
    }

    // markName is always a direct string
    if (anchorCategory === 'markName') {
        return value;
    }

    // text follows encoding rules
    if (anchorCategory === 'text') {
        const exprValue = isDataContext ? `datum[${value}]` : value;
        return { expr: exprValue };
    }

    return null;
}

export function calculateValueFor(key: string, inputContext: CompilationContext, signals: any[]): any {
    return formatValue(
        resolveValue(key, inputContext, signals)
    );
}

// Helper to determine anchor category
function determineAnchorCategory(key: string): keyof AnchorTypeMapping {
    for (const [category, keys] of Object.entries(anchorTypeCategories)) {
        if (keys.includes(key) || keys.some(k => key.startsWith(k))) {
            return category as keyof AnchorTypeMapping;
        }
    }
    return 'encoding'; // default to encoding type
}


interface CompiledValue {
    expr?: string;
    start?: { expr: string };
    stop?: { expr: string };
}

interface SchemaResolution {
    // Map from schema key to its compiled value
    [key: string]: CompiledValue;
}

export function resolveSchemaValues(
    schemaValues: Record<string, BindingEdge[]>,
    baseSchema: Record<string, SchemaType>,
    signals: any[]
): SchemaResolution {
    const resolution: SchemaResolution = {};

    Object.entries(baseSchema).forEach(([key, schema]) => {
        const edges = schemaValues[key] || [];
        
        switch(schema.container) {
            case 'Range':
                resolution[key] = resolveRangeValue(edges, signals);
                break;
            case 'Scalar':
                resolution[key] = resolveScalarValue(edges, signals);
                break;
            case 'Set':
                resolution[key] = resolveSetValue(edges, signals);
                break;
            // etc.
        }
    });

    return resolution;
}

function resolveRangeValue(edges: BindingEdge[], signals: any[]): CompiledValue {
    // Collect all min/max constraints from edges
    const minConstraints = edges.filter(e => e.target.anchorId.includes('_min'));
    const maxConstraints = edges.filter(e => e.target.anchorId.includes('_max'));

    return {
        min: { expr: compileConstraints(minConstraints, signals) },
        max: { expr: compileConstraints(maxConstraints, signals) }
    };
}

function resolveScalarValue(edges: BindingEdge[], signals: any[]): CompiledValue {
    return {
        value: { expr: compileConstraints(edges, signals) }
    };
}

function resolveSetValue(edges: BindingEdge[], signals: any[]): CompiledValue {
    return {
        values: edges.map(edge => ({
            expr: compileConstraint(edge, signals)
        }))
    };
}

function compileConstraints(edges: BindingEdge[], signals: any[]): string {
    // No constraints or signals
    if (edges.length === 0 && (!signals || signals.length === 0)) {
        return '';
    }

    // First, convert edges to constraints
    const constraints = edges.map(edge => {
        // Find matching signal if it exists
        const relatedSignal = signals.find(s => 
            s.name === `${edge.source.nodeId}_${edge.source.anchorId}`
        );

        if (relatedSignal) {
            return {
                value: relatedSignal.name,
                triggerReference: `${edge.source.nodeId}_${edge.source.anchorId}`
            };
        }

        // If no signal found, use the edge directly
        return {
            value: edge.source.anchorId,
            triggerReference: `${edge.source.nodeId}_${edge.source.anchorId}`
        };
    });

    // If we have multiple constraints, we need to combine them
    if (constraints.length > 1) {
        // Combine constraints using appropriate operators
        return constraints.map(c => {
            const compiledValue = compileConstraint(c);
            return `(${compiledValue})`;
        }).join(' + ') + ` / ${constraints.length}`; // Average multiple values
    }

    // Single constraint
    if (constraints.length === 1) {
        return compileConstraint(constraints[0]);
    }

    // Fallback to first available signal if no constraints
    if (signals && signals.length > 0) {
        return signals[0].name;
    }

    return '';
}




/// For data mapping:
interface SchemaSignals {
    [schemaKey: string]: {
        signals: any[];
        isDataContext: boolean;  // For determining if we need datum[] wrapping
    }
}


export function calculateValueForItem(component: BaseComponent, signals: any[], constraints: Record<string, any[]>): CompiledValue {
    
    const schemaMapping: SchemaSignals = {};
    
    // Get base schema keys from default configuration
    const baseConfig = component.configurations.find(config => config.default);
    if (!baseConfig) return schemaMapping;

    const baseSchema = baseConfig.schema;


    const compiledValue: CompiledValue = {};
    Object.entries(baseSchema).forEach(([key, schema]) => {
        // Check if this is a range type schema
        if (schema.container === 'Range') {
            // For range types, look for start and stop values
            const startKey = `${key}1`;
            const stopKey = `${key}2`;

            
            const startValue = formatValue(resolveValue(startKey, constraints, signals));
            const stopValue = formatValue(resolveValue(stopKey, constraints, signals));

            
            compiledValue[key as keyof CompiledValue] = {
                start: startValue || { expr: '' },
                stop: stopValue || { expr: '' }
            };
        } else {
            // Regular scalar value
            const value = formatValue(resolveValue(key, constraints, signals));
            if (value) {
                compiledValue[key as keyof CompiledValue] = value;
            }
        }
    });
    
    return compiledValue;
}

export function mapSchemaToSignals(
    component: BaseComponent,
    allSignals: any[],
    edges: BindingEdge[],
): SchemaSignals {
    const schemaMapping: SchemaSignals = {};
    
    // Get base schema keys from default configuration
    const baseConfig = component.configurations.find(config => config.default);
    if (!baseConfig) return schemaMapping;

    // For each schema key, find relevant signals
    Object.keys(baseConfig.schema).forEach(schemaKey => {
        // Find edges targeting this schema key
        const relevantEdges = edges.filter(edge => {
            
            return isAnchorTypeCompatible(schemaKey, edge.target.anchorId)
        });

        const signalBaseId = baseConfig.id + '_' + schemaKey;

        const schemaType = baseConfig.schema[schemaKey]?.container || 'scalar';

        // Find signals based on schema type
        let relevantSignals = [];
        
        //TODO use containeer type not strings..
        if (schemaType === 'Scalar' || schemaType === 'Absolute') {
            // For scalar types, look for a single signal
            relevantSignals =[allSignals.find(signal => 
                signal.name.includes(signalBaseId) || 
                signal.name.includes(`${component.id}_${schemaKey}`)
            )];
        } 
        else if (schemaType === 'Range') {
            const startId = baseConfig.id + '_start_' + schemaKey 
            // For range types, look for start/min and stop/max signals
            const minSignal = allSignals.find(signal => 
                signal.name.includes(startId)
            );
            
            const stopId = baseConfig.id + '_stop_' + schemaKey 
            const maxSignal = allSignals.find(signal => 
                signal.name.includes(stopId) 
            );
            
            relevantSignals = [ minSignal, maxSignal];
        }
        else if (schemaType === 'Set') {
            // For set types, look for multiple values
            relevantSignals = allSignals.filter(signal => 
                signal.name.includes(signalBaseId) || 
                signal.name.startsWith(`${component.id}_${schemaKey}_`)
            );
        }

        
        // Find signals that correspond to these edges
        // const relevantSignals = allSignals.filter(signal => {
        //     return relevantEdges.some(edge => 
        //         signal.name.includes(`${edge.source.nodeId}_${edge.source.anchorId}`)
        //     );
        // });

        // Check if any edge is from a data context
        const isDataContext = relevantEdges.some(edge => {
            // Logic to determine if edge is from data context
            return edge.source.nodeId.includes('data_'); // This might need adjustment
        });

        schemaMapping[schemaKey] = {
            signals: relevantSignals,
            isDataContext
        };
    });

    console.log('Schema to Signals mapping:', schemaMapping);
    return schemaMapping;
}


interface CompiledSignalValue {
    expr: string;
}

function compileSignalsToExpression(
    signals: any[],
    isDataContext: boolean
): CompiledSignalValue {
    // If no signals, return empty expression
    if (!signals || signals.length === 0) {
        return { expr: '' };
    }

    // For data context, use the first signal name as a field reference
    if (isDataContext) {
        return { expr: `datum[${signals[0].name}]` };
    }

    // For regular signals with update expressions
    if (signals[0].update) {
        return { expr: signals[0].update };
    }

    // Default case: just use the signal name
    return { expr: signals[0].name };
}

// Usage in mapSchemaToSignals:
export function mapSchemaToExpressions(
    mappedSchema: SchemaSignals,
    baseSchema: Record<string, SchemaType>
): Record<string, CompiledValue> {
    const expressions: Record<string, CompiledValue> = {};
    
    Object.entries(baseSchema).forEach(([schemaKey, schema]) => {
        const { signals, isDataContext } = mappedSchema[schemaKey] || 
            { signals: [], isDataContext: false };


        if(!signals || signals.length === 0 || !Array.isArray(signals) || signals.includes(undefined)) {
            return;
        }


        if (schema.container === 'Range') {

            // For ranges, find start and stop signals
            const startSignals = signals.filter(s => s.name.includes('_start_'));
            const stopSignals = signals.filter(s => s.name.includes('_stop_'));

            expressions[schemaKey] = {
                start: { 
                    expr: isDataContext ? 
                        `datum[${startSignals[0]?.name}]` : 
                        startSignals[0]?.name || ''
                },
                stop: { 
                    expr: isDataContext ? 
                        `datum[${stopSignals[0]?.name}]` : 
                        stopSignals[0]?.name || ''
                }
            };
        } else {
            // For non-ranges (Scalar, Set, etc)
            expressions[schemaKey] = {
                expr: isDataContext ? 
                    `datum[${signals[0]?.name}]` : 
                    signals[0]?.name || ''
            };
        }
    });

    return expressions;
}

export function addAbsoluteValues(
    expressions: Record<string, CompiledValue>,
    baseSchema: Record<string, SchemaType>,
    constraints: Record<string, any[]>
): Record<string, CompiledValue> {
    Object.keys(baseSchema).forEach(schemaKey => {
        // Find compatible constraint keys
        const compatibleKeys = Object.keys(constraints).filter(constraintKey => 
            areNamesCompatible(schemaKey, constraintKey)
        );

        // Check each compatible key for absolute constraints
        compatibleKeys.forEach(constraintKey => {
            const absoluteConstraints = constraints[constraintKey]?.filter(
                constraint => constraint.type === 'absolute'
            );

            if (absoluteConstraints?.length > 0) {
                if (baseSchema[schemaKey].container === 'Range') {
                    // For Range types, check for start/stop absolutes
                    const startAbsolute = absoluteConstraints.find(c => 
                        c.anchorId?.includes('_start') || c.triggerReference?.includes('_start')
                    );
                    const stopAbsolute = absoluteConstraints.find(c => 
                        c.anchorId?.includes('_stop') || c.triggerReference?.includes('_stop')
                    );

                    expressions[schemaKey] = {
                        start: startAbsolute ? 
                            { expr: startAbsolute.value } : 
                            expressions[schemaKey]?.start,
                        stop: stopAbsolute ? 
                            { expr: stopAbsolute.value } : 
                            expressions[schemaKey]?.stop
                    };
                } else {
                    // For non-Range types, use the first absolute value
                    expressions[schemaKey] = {
                        expr: absoluteConstraints[0].triggerReference

                    };
                }
            }
        });
    });

    return expressions;
}




// Usage in main pipeline:
export function getAllExpressions(
    mappedSchema: SchemaSignals,
    baseSchema: Record<string, SchemaType>,
    constraints: Record<string, any[]>
): Record<string, CompiledValue> {
    // First create expressions from signals
    let expressions = mapSchemaToExpressions(mappedSchema, baseSchema);
    
    // Then add/override with absolute values from constraints
    expressions = findCompatibleValue2(expressions, baseSchema, constraints);

    return expressions;
}


function findCompatibleValue2(
    expressions: Record<string, CompiledValue>,
    baseSchema: Record<string, SchemaType>,
    constraints: Record<string, any[]>
): Record<string, CompiledValue> {

    // Process each schema key in the base schema
    Object.entries(baseSchema).forEach(([key, schema]) => { 
        // If this schema key isn't already in expressions, try to resolve a value for it
        if (!expressions[key] && Object.keys(constraints).length > 0) {
            const value = formatValue(resolveValue(key, constraints, []));
            // // If we found a value, add it to expressions
            // if (value && value.value) {
            //     if (schema.container === 'Range') {
            //         expressions[key] = {
            //             start: { expr: value.value },
            //             stop: { expr: value.value }
            //         };
            //     } else {
            //         expressions[key] = {
            //             expr: value.value
            //         };
            //     }
            //     expressions[key] = {
            //     expr: value.value
            // };
            // }
            if(value){
                expressions[key] = value;
            }

            
        }
    });


 
    // // 2. Check input context for constraints
    // const compatibleKeys = Object.keys(inputContext).filter(contextKey =>
    //     areNamesCompatible(key, contextKey)
    // );

    // if (compatibleKeys.length > 0) {
    //     const constraints = inputContext[compatibleKeys[0]];
    //     if (Array.isArray(constraints) && constraints.length > 0) {
    //         // Take the first valid constraint
    //         const constraint = constraints.find(c => c && (c.value || c.triggerReference));
    //         if (constraint) {
    //             return compileConstraint(constraint);
    //         }
    //     }
    // }

    // // 3. Handle special cases
    // if (key === 'data') {
    //     return 'data';
    // }

    // 4. No compatible value found
    return expressions  ;
}