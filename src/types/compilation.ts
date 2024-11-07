import { BaseComponent } from "components/base";
import { Anchor, AnchorOrGroup, AnchorProxy } from "./anchors";
import { TopLevelUnitSpec } from 'vega-lite/build/src/spec/unit';
import { Field } from "vega-lite/build/src/channeldef";

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
  // Each component can return a partial unit spec
  spec?: Partial<TopLevelUnitSpec<Field>>;
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
