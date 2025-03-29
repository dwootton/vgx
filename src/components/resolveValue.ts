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
    const dataReferences = analyzeDataContext(inputContext);
    const value = findCompatibleValue(key, inputContext, signals);
    const anchorCategory = determineAnchorCategory(key);

    const isDataContext = Array.from(dataReferences).some(reference => {
        if(value?.includes(reference)){
            return true;
        }
        return false;
    })


    return {
        key,
        value,
        isDataContext: isDataContext,
        anchorCategory
    };
}


type DataContext = Set<string>;

function analyzeDataContext(inputContext: CompilationContext): DataContext {
    const dataNodes = new Set<string>();
    const dataReferences = new Set<string>();
    
    // First pass: identify all data nodes
    Object.entries(inputContext).forEach(([_, constraints]) => {
        if (!Array.isArray(constraints)) return;
        
        constraints.forEach(constraint => {
            if (constraint?.type === 'data') {
                const nodeId = constraint.triggerReference.split('_').slice(0, 2).join('_');
                dataNodes.add(nodeId);
            }
        });
    });

    // Second pass: find references connected to data nodes
    Object.entries(inputContext).forEach(([key, constraints]) => {
        if (!Array.isArray(constraints)) return;
        
        constraints.forEach(constraint => {
            if (constraint?.triggerReference) {
                const referenceNodeId = constraint.triggerReference.split('_').slice(0, 2).join('_');
                // If this reference connects to a data node, mark it
                if (dataNodes.has(referenceNodeId)) {
                    dataReferences.add(key);
                }
            }
        });
    });

    return dataReferences
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

function formatValue({ value, isDataContext, anchorCategory, key }: ValueResolutionContext): any {
    if (anchorCategory === 'data') {
        if(value === 'data'){
            // push a single value to render a mark
            return {'values': [{'value': 'sampledatamark'}]}
        }
        return { name: value };
    }

    // For encodings, wrap in datum[] if in data context
    if (anchorCategory === 'encoding' || anchorCategory === 'text') {
        const exprValue = isDataContext ? `datum[${value}]` : value;
        return { expr: exprValue };
    }

    // markName is always a direct string, if no markname then null well allow targeting canvas
    if (anchorCategory === 'markName') {
        return value ? value+"_marks" : null;
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



export function calculateValueForComponent(component: BaseComponent, signals: any[], constraints: Constraint[]): any {
    // Get the base schema from the component's configurations
    const baseSchema = component.configurations.find(config => config.default)?.schema || {};
    
    // Create a context object to hold all calculated values
    const context: Record<string, any> = {};
    
    // Process each key in the base schema
    for (const key of Object.keys(baseSchema)) {
        const value = calculateValueFor(key, constraints, signals);
        context[key] = value;
    }


    return context
}
