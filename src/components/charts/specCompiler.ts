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
  
    public compile(rootComponent: BaseComponent): TopLevelSpec {
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
  
    private compileComponent(
      component: BaseComponent,
      context: CompilationContext,
      parentInfo?: ParentInfo
    ): CompilationResult {
      if (context.compiledComponents.has(component.id)) {
        return { spec: {}, generatedData: {} };
      }
  
      context.compiledComponents.add(component.id);
  
      // Compile the component itself
      const componentResult = component.compileComponent(context, parentInfo);
  
      // Compile child components
      const childBindings = context.bindings.filter(b =>
        b.source.componentId === component.id
      );
  
      const childResults = childBindings.map(binding => {
        const childComponent = this.getComponent(binding.target.componentId);
        if (!childComponent) return { spec: {}, generatedData: {} };
  
        const childParentInfo: ParentInfo = {
          boundAnchor: this.getAnchor(binding),
          parentComponent: component
        };
  
        return this.compileComponent(childComponent, context, childParentInfo);
      });
  
      // Collect generated data and generators from child results
      componentResult.generatedData = childResults.reduce((acc, result) => {
        return { ...acc, ...result.generatedData };
      }, componentResult.generatedData || {});
  
      componentResult.generators = childResults.flatMap(result => result.generators || []);
  
      // Collect placeholders from the current component
      if (componentResult.placeholders) {
        context.placeholders.push(...componentResult.placeholders);
      }
  
      if (componentResult.generators) {
        context.generators.push(...componentResult.generators);
      }
  
      return componentResult;
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
          return generator[placeholder.property];
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
  
    private getAnchor(binding: any): AnchorProxy {
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