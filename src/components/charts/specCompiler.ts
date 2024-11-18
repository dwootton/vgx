import { BaseComponent } from '../base';
import { CompilationContext, CompilationResult, ParentInfo, Binding } from '../../types/compilation';
import { BindingGraph } from '../../utils/bindingGraph';
import { BindingStore } from '../../utils/bindingStore';
import { TopLevelSpec } from 'vega-lite';
import { AnchorProxy } from '../../types/anchors';

export class SpecCompiler {
    private bindingStore: BindingStore;
    private bindingGraph: BindingGraph;
  
    constructor() {
      this.bindingStore = BindingStore.getInstance();
      this.bindingGraph = this.bindingStore.getDefaultGraph();
    }
  
    public compileRootComponent(rootComponent: BaseComponent): TopLevelSpec {
      const context: CompilationContext = {
        bindings: this.bindingStore.getDefaultGraph().getBindings(),
        compiledComponents: new Set(),
        placeholders: [], // Track placeholders during initial compilation
        generators: [] // Track generators that produce data
      };
  
      // Compile all components (first pass)
      const initialResult = this.compileComponent(rootComponent, context);
  
      // Second pass: resolve placeholders by navigating through the result and checking for generated data
      this.resolvePlaceholders(context, initialResult);
  
      // Merge the final compilation result
      return {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        ...(initialResult.spec || {})
      };
    }

    
  
    public compileComponent(
      component: BaseComponent,
      context: CompilationContext,
      parentInfo?: ParentInfo
    ): CompilationResult {
      if (context.compiledComponents.has(component.id)) {
        return { binding: context.bindings[0], spec: {}, generatedData: {} };
      }
  
      context.compiledComponents.add(component.id);
  
      // Compile the component itself
      const componentResult = component.compileComponent(context, parentInfo);
  
      const childBindings = this.bindingGraph.getSourceBindings(component.id);
      // Compile child components
      // const childBindings = context.bindings.filter(b =>
      //   b.childAnchorId.componentId === component.id
      // );
  
      // look here to see what parent info is being passed
      const childResults = childBindings.map(binding => {

        const childComponent = this.getComponent(binding.childAnchorId.componentId);
        if (!childComponent) return { binding: binding, spec: {}, generatedData: {} };
  
        const childAnchor = childComponent.anchors.get(binding.childAnchorId.anchorId);
        const parentAnchor = component.anchors.get(binding.parentAnchorId.anchorId);
        if (!childAnchor || !parentAnchor) return { binding: binding, spec: {}, generatedData: {} };// TODO: handle is anchor is not found
        const childParentInfo: ParentInfo = {
          childAnchor: childAnchor,//this.getParentAnchor(binding),
          parentAnchor: parentAnchor,
          parentComponent: component
        };
  
        const childResult = this.compileComponent(childComponent, context, childParentInfo);
        return { binding: binding, componentId: binding.childAnchorId.componentId, spec: childResult.spec, generatedData: {} };
      });

      const compiledResults: CompilationResult[] = [componentResult, ...(childResults||[])];
      // Merge the results
      const mergedResult = compiledResults.length > 1 ? this.mergeResults(compiledResults) : compiledResults[0].spec;

      return {'spec': mergedResult};


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

    private mergeResults(results: CompilationResult[]): CompilationResult {
    
      let vegaLiteSpec: Partial<TopLevelSpec> = {};
      const bindings = results.map(r => r.binding).filter(b => b);
      

      for(const binding of bindings) {
        const parentComponent = this.getComponent(binding.parentAnchorId.componentId);
        const childComponent = this.getComponent(binding.childAnchorId.componentId);
        if (!parentComponent || !childComponent) continue;
        const parentAnchor = parentComponent.anchors.get(binding.parentAnchorId.anchorId);
        const childAnchor = childComponent.anchors.get(binding.childAnchorId.anchorId);
        if (!parentAnchor || !childAnchor) continue;
       
        const parentResult = results.find(r => r.componentId === parentComponent.id);
        const childResult = results.find(r => r.componentId === childComponent.id);
        // Handle geometric-geometric binding
        if (parentAnchor.anchorRef.type === 'geometric' && childAnchor.anchorRef.type === 'geometric') {
          // Find the compilation results for both components
          console.log('in geometric-geometric binding',childResult?.spec, parentResult?.spec);
          
          
          if (parentResult?.spec && childResult?.spec) {
            vegaLiteSpec = {
              layer: [
                parentResult.spec,
                childResult.spec
              ]
            };
            console.log('vegaLiteSpec', vegaLiteSpec);
          }
        }

        /// 

        // Handle geometric-event binding
        else if (parentAnchor.anchorRef.type === 'geometric' && childAnchor.anchorRef.type === 'event') {
          console.log('in geometric-event binding',childResult?.spec, parentResult?.spec);

          //const childResult = results.find(r => r.binding?.childAnchorId.componentId === childComponent.id);
          if (childResult?.spec) {
            vegaLiteSpec = {
              ...vegaLiteSpec,
              ...parentResult.spec,
              ...childResult.spec
            };
            console.log('vegaLiteSpec', vegaLiteSpec);
          }
        }

        // Handle event-geometric binding
        else if (parentAnchor.anchorRef.type === 'event' && childAnchor.anchorRef.type === 'geometric') {
          throw new Error('Event to geometric binding not implemented yet');
        }

        // Handle encoding-geometric binding
        else if (parentAnchor.anchorRef.type === 'encoding' && childAnchor.anchorRef.type === 'geometric') {
          // parent binding encoding means that 
          throw new Error('Encoding to geometric binding not implemented yet');
        }
        // if parent 
        // if parent 

      }
      // now for each binding, extract the type of parent and child anchors, and information about each
      const bindingTypes = bindings.map(b => ({
        parentAnchorType: b.parentAnchorId.anchorType,
        childAnchorType: b.childAnchorId.anchorType,
        parentComponentId: b.parentAnchorId.componentId,
        childComponentId: b.childAnchorId.componentId
      }))


      // TODO: implement
      return vegaLiteSpec;
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