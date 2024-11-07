import { BaseComponent } from "components/base";
import { Anchor, AnchorOrGroup, AnchorProxy } from "./anchors";

export interface ComponentRef {
    componentId: string;
    anchorId: string;  // Just stores which anchor was used in the binding
}

export interface Binding {
    id: string;
    source: ComponentRef;
    target: ComponentRef;
    sourceType: 'geometric' | 'encoding' | 'event' | 'group';
    targetType: 'geometric' | 'encoding' | 'event' | 'group';
}


export interface ParentInfo {
    boundAnchor: AnchorProxy;
    parentComponent: BaseComponent;
}

export interface CompilationContext {
    bindings: Binding[];
    compiledComponents: Set<string>;
}

export interface CompilationResult {
    // For Vega-Lite parameter specs (like selections)
    parameters?: any[];
    
    // For any mark specifications
    marks?: any[];
    
    // For encoding modifications
    encoding?: Record<string, any>;
    
    // For any additional transforms
    transform?: any[];
}

// // Helper function to merge compilation results
// export function mergeCompilationResults(...results: CompilationResult[]): CompilationResult {
//   const merged: CompilationResult = {};

//   results.forEach(result => {
//     // Merge arrays
//     ['parameters', 'marks', 'scales', 'signals', 'transform'].forEach(key => {
//       if (result[key]) {
//         merged[key] = merged[key] || [];
//         merged[key].push(...result[key]);
//       }
//     });

//     // Merge encoding objects
//     if (result.encoding) {
//       merged.encoding = {
//         ...merged.encoding,
//         ...result.encoding
//       };
//     }
//   });

//   return merged;
// }
