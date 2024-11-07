//       //@ts-nocheck

// import { BindingGraph } from '../../utils/bindingGraph';
// import { Binding, CompilationResult ,CompilationContext, ParentInfo} from '../../types/compilation';
// import { Anchor, AnchorOrGroup, AnchorProxy } from '../../types/anchors';
// import { BaseComponent } from '../base';
// import { BindingStore } from '../../utils/bindingStore';
// import { TopLevelUnitSpec } from 'vega-lite/build/src/spec/unit';
// import { TopLevelSpec } from 'vega-lite';
// import { TopLevelProperties } from 'vega-lite/build/src/spec/toplevel';
// import { Field } from 'vega-lite/build/src/channeldef';

// export class SpecCompiler {
//     private bindingGraph: BindingGraph;
//     private bindingStore: BindingStore;

//     constructor() {
//         this.bindingStore = BindingStore.getInstance();
//         this.bindingGraph = this.bindingStore.getDefaultGraph();
//     }

//     private mergeResults(...results: CompilationResult[]): CompilationResult {
//       // Collect all component specs
//       return {
//         components: results.flatMap(result => result.components || [])
//       };
//     }

//     private compileResults(mergedResult: CompilationResult[]): TopLevelSpec {
//       const baseSpec: TopLevelSpec = {
//         "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
//       };
    
//       // Filter out empty results
//       const specs = mergedResult.filter(r => r.spec && Object.keys(r.spec).length > 0)
//                                .map(r => r.spec!);
      
//       if (specs.length === 0) return baseSpec;
    
//       // Check which specs have marks or layers
//       const hasMarks = specs.filter(spec => spec.mark || spec.layer);
    
//       if (hasMarks.length <= 1) {
//         // If no marks or only one mark-based spec, merge all specs
//         return specs.reduce((merged, spec) => ({
//           ...merged,
//           ...spec,
//           // Special handling for arrays like params
//           params: [...(merged.params || []), ...(spec.params || [])],
//           transform: [...(merged.transform || []), ...(spec.transform || [])]
//         }), baseSpec);
//       } else {
//         // Multiple mark-based specs need layers
//         return {
//           ...baseSpec,
//           layer: hasMarks
//         };
//       }
//     }
    
    
    
//       public compile(rootComponent: BaseComponent): TopLevelSpec {
//         const context: CompilationContext = {
//           bindings: this.bindingGraph.getBindings(),
//           compiledComponents: new Set()
//         };
    
//         console.log('context',context);
//         // Start compilation from root and get merged results
//         const mergedResult = this.compileComponent(rootComponent, context);
    
//         console.log('mergedResult',mergedResult);
//         // Create the final Vega-Lite spec
//         return this.compileResults(mergedResult);
//       }
    
//       private compileComponent(
//         component: BaseComponent,
//         context: CompilationContext,
//         parentInfo?: ParentInfo
//       ): CompilationResult {
//         if (context.compiledComponents.has(component.id)) {
//           return {};
//         }
    
//         context.compiledComponents.add(component.id);
//         console.log('component',component);
    
//         const componentResult = component.compileComponent(context, parentInfo);
    
//         const childBindings = context.bindings.filter(b =>
//           b.source.componentId === component.id
//         );
    
//         const childResults = childBindings.map(binding => {
//           const childComponent = this.getComponent(binding.target.componentId);
//           if (!childComponent) return {};
    
//           const childParentInfo: ParentInfo = {
//             boundAnchor: this.getAnchor(binding),
//             parentComponent: component
//           };
    
//           return this.compileComponent(childComponent, context, childParentInfo);
//         });
    
//         console.log('componentResult',componentResult);
//         console.log('childResults',childResults);
//         const mergedResult = this.mergeResults(componentResult, ...childResults);
//         console.log('mergedResult',mergedResult);
//         return mergedResult;
//       }
    
//       public getComponent(componentId: string): BaseComponent | undefined {
//         return this.bindingStore.getComponent(componentId);
//       }
    
//       private getAnchor(binding: Binding): AnchorProxy {
//         const sourceComponent = this.getComponent(binding.source.componentId);
//         if (!sourceComponent) {
//           throw new Error(`Component ${binding.source.componentId} not found`);
//         }
    
//         const anchor = sourceComponent.anchors.get(binding.source.anchorId);
//         if (!anchor) {
//           throw new Error(`Anchor ${binding.source.anchorId} not found on component ${binding.source.componentId}`);
//         }
    
//         return anchor;
//       }
//     }