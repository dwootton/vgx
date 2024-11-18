import { BaseComponent } from '../base';
import { CompilationContext, ParentInfo, Binding } from '../../types/compilation';
import { BindingGraph } from '../../utils/bindingGraph';
import { BindingStore } from '../../utils/bindingStore';
import { TopLevelSpec } from 'vega-lite';
import { AnchorProxy } from '../../types/anchors';
import { LayerSpec, UnitSpec} from 'vega-lite/build/src/spec';
import { Field  } from 'vega-lite/build/src/channeldef';




export class SpecCompiler {
    private bindingStore: BindingStore;
    private bindingGraph: BindingGraph;
  
    constructor() {
      this.bindingStore = BindingStore.getInstance();
      this.bindingGraph = this.bindingStore.getDefaultGraph();
    }
  
    public compileRootComponent(rootComponent: BaseComponent): TopLevelSpec {

      const context: CompilationContext = {
        parentCompilation: {},
        //@ts-ignore
        binding: {childAnchorId: {componentId: rootComponent.id, anchorId: 'root'}},
      };
      
  
      // Compile all components (first pass)
      const initialResult = this.compileComponentRecursive(rootComponent, context);

      const mergedResult = this.mergeResults(initialResult);

      function moveParamsToTopLevel(spec: Partial<TopLevelSpec>){
        // traverse the spec and move all params to the top level
        const params: any[] = [];
        
        // Collect all params
        const traverse = (obj: any) => {
          for (const key in obj) {
            if (key === 'params' && Array.isArray(obj[key])) {
              params.push(...obj[key]);
              delete obj[key];
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
              traverse(obj[key]);
            }
          }
        };
        
        traverse(spec);
        
        // Add collected params to top level
        if (params.length > 0) {
          spec.params = params;
        }
      }

      moveParamsToTopLevel(mergedResult);
      console.log('final:mergedResult', mergedResult);
      return  mergedResult

      // extract params to top level:

  
      // Second pass: resolve placeholders by navigating through the result and checking for generated data
  
      // Merge the final compilation result
      //@ts-ignore
      return {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        ...(initialResult.spec || {})
      };
    }

    public mergeResults(results: CompilationContext[]): Partial<UnitSpec<Field>> {
      // TODO: respect when a child has multiple parents  


      // Helper to check if spec has layer/mark
      const hasLayerOrMark = (spec: any) => {
        return spec.layer || spec.mark;
      };

      // Recursive merge function
      const mergeWithChildren = (result: CompilationContext, allResults: CompilationContext[]): Partial<UnitSpec<Field>> => {
        // Find direct children
        const children = allResults.filter(r => {
          return r.binding.parentAnchorId?.componentId === result.binding.childAnchorId.componentId;
        });
        console.log('childSpecs', allResults);


        // Base case - no children
        if (children.length === 0) {
          return result.spec;
        }

        // Merge all children recursively
        const childSpecs = children.map(child => mergeWithChildren(child, allResults));
        console.log('childSpecs', childSpecs);

        // Merge current result with children
        const mergedChildSpecs = childSpecs.reduce((merged:any, childSpec) => {
          // If either has layer/mark, create layer spec
          if (hasLayerOrMark(merged) && hasLayerOrMark(childSpec)) {
            console.log('hasLayerOrMark', merged, childSpec);
            return {
              layer: [
                merged,
                childSpec
              ]
            };
          }

          // Otherwise merge normally
          const mergedSpec = {
            ...merged,
            ...childSpec,
            // Concatenate params if they exist
            params: [
              ...(merged.params || []),
              ...(childSpec.params || [])
            ]
          };
          console.log('mergedSpec', mergedSpec);
          return mergedSpec;
        }, result.spec);
        console.log('mergedChildSpecs', mergedChildSpecs);
        return mergedChildSpecs;
      };

      // Find root result (empty binding)
      const rootResult = results.find(r => !r.binding.parentAnchorId);
      console.log('rootResult', rootResult);
      if (!rootResult) {
        throw new Error('No root result found');
      }

      // Start merge from root
      const mergedResult = mergeWithChildren(rootResult, results);
      console.log('mergedResult', mergedResult);
      return mergedResult;

    }
  
    public compileComponentRecursive(
      component: BaseComponent,
      context: CompilationContext,
    ): CompilationContext[] {
      const result: CompilationContext = { spec: {}, binding: context.binding, children: []};
      // Compile the component itself
      const parentResult = component.compileComponent(context);
      result.spec = parentResult;

  
      const childBindings = this.bindingGraph.getBindingsAsParent(component.id);
      
      const childResults = childBindings.map(binding => {
        
        const childComponent = this.getComponent(binding.childAnchorId.componentId);
        if (!childComponent) throw new Error(`Child component ${binding.childAnchorId.componentId} not found`);
        const childContext: CompilationContext = { spec: {}, binding: binding};
        const childResult = this.compileComponentRecursive(childComponent, childContext);

        
  
        console.log('childResult', childResult);
        return childResult;
      });

      const compiledResults: CompilationContext[] = [result, ...childResults.flatMap(r => r)];
      console.log('compiledResults', compiledResults);
      return compiledResults;
      
      // 



      // // form into tree of results 

      // // Merge the results
      // const mergedResult = compiledResults.length > 1 ? this.mergeResults(compiledResults) : compiledResults[0].spec;
      // console.log('mergedResult', mergedResult);

      // function moveParamsToTopLevel(spec: Partial<TopLevelSpec>){
      //   // traverse the spec and move all params to the top level
      //   const params: any[] = [];
        
      //   // Collect all params
      //   const traverse = (obj: any) => {
      //     for (const key in obj) {
      //       if (key === 'params' && Array.isArray(obj[key])) {
      //         params.push(...obj[key]);
      //         delete obj[key];
      //       } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      //         traverse(obj[key]);
      //       }
      //     }
      //   };
        
      //   traverse(spec);
        
      //   // Add collected params to top level
      //   if (params.length > 0) {
      //     spec.params = params;
      //   }
      // }

      // let finalSpec = moveParamsToTopLevel(mergedResult);


      // return {'spec': mergedResult};



      ///END OLD UNCOMENT

      // go through each binding

      // now that everything is compiled, we neeed to merge results
      // interface CompilationResult2 {
      //     binding:Binding;
      //     // Each component can return a partial unit spec
      //     spec?: Partial<TopLevelUnitSpec<Field>>;
      //     generatedData?: Record<string, any>; // Holds data generated by the component
      //     placeholders?: Placeholder[]; // List of placeholders this component has
      //     generators?: Generator[]; // List of generators from the component
      // }
      







      // const mergedResult = this.mergeResults(componentResult, ...childResults,);
  
      // // Collect generated data and generators from child results
      // componentResult.generatedData = childResults.reduce((acc, result) => {
      //   return { ...acc, ...result.generatedData };
      // }, componentResult.generatedData || {});
    
      // // Collect placeholders from the current component
      // if (componentResult.placeholders) {
      //   context.placeholders.push(...componentResult.placeholders);
      // }
  
      // if (componentResult.generators) {
      //   context.generators.push(...componentResult.generators);
      // }
  
      // return {...componentResult};
    }
    private validateBindings(bindingGraph: BindingGraph): void {

      // TODO: validate that the bindings are valid
    }

    
  
    private resolvePlaceholders(context: CompilationContext, result: CompilationResult) {
      // Traverse the compilation result and resolve placeholders
      if (result.spec) {
        this.resolvePlaceholdersInSpec(result.spec, context);
      }
    }
  
    private resolvePlaceholdersInSpec(spec: any, context: CompilationContext) {
      for (const placeholder of context.placeholders) {
        const generatedData = this.findGeneratedDataForPlaceholder(placeholder, context);
        if (generatedData) {
          this.replacePlaceholderInSpec(spec, placeholder, generatedData);
        }
      }
    }
  
    private findGeneratedDataForPlaceholder(placeholder: any, context: CompilationContext): any {
      // Search for generated data provided by generators
      for (const generator of context.generators) {
        if (placeholder.property in generator) {
          //TODO find generators
          //return generator[placeholder.property];
        }
      }
      return null;
    }
  
    private replacePlaceholderInSpec(spec: any, placeholder: any, value: any) {
      for (const key in spec) {
        if (typeof spec[key] === 'object' && spec[key] !== null) {
          this.replacePlaceholderInSpec(spec[key], placeholder, value);
        } else if (spec[key] === `placeholder_${placeholder.componentId}_${placeholder.property}`) {
          spec[key] = value;
        }
      }
    }
  
    private getComponent(componentId: string): BaseComponent | undefined {
      return this.bindingStore.getComponent(componentId);
    }
  
    private getParentAnchor(binding: any): AnchorProxy {
      const sourceComponent = this.getComponent(binding.source.componentId);
      if (!sourceComponent) {
        throw new Error(`Component ${binding.source.componentId} not found`);
      }
  
      const anchor = sourceComponent.anchors.get(binding.source.anchorId);
      if (!anchor) {
        throw new Error(`Anchor ${binding.source.anchorId} not found on component ${binding.source.componentId}`);
      }
  
      return anchor;
    }
  }