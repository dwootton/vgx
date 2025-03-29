import { CompilationContext } from "../binding/binding";
import { areNamesCompatible, generateAnchorId,  } from "./utils";
import { compileConstraint } from "../binding/constraints";

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

    return {
        key,
        value,
        isDataContext: dataContext.hasDataConstraints,
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