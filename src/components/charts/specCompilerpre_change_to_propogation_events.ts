      //@ts-nocheck

      import { BindingGraph } from '../../utils/bindingGraph';
      import { Binding, CompilationResult ,CompilationContext, ParentInfo} from '../../types/compilation';
      import { Anchor, AnchorOrGroup, AnchorProxy } from '../../types/anchors';
      import { BaseComponent } from '../base';
      import { BindingStore } from '../../utils/bindingStore';
      import { TopLevelUnitSpec } from 'vega-lite/build/src/spec/unit';
      import { TopLevelSpec } from 'vega-lite';
      import { TopLevelProperties } from 'vega-lite/build/src/spec/toplevel';
      import { Field } from 'vega-lite/build/src/channeldef';
      export class SpecCompiler {
        private bindingStore: BindingStore;
        private bindingGraph: BindingGraph;
      
        constructor() {
            this.bindingStore = BindingStore.getInstance();
            this.bindingGraph = this.bindingStore.getDefaultGraph();
        }
      
        private mergeResults(...results: CompilationResult[]): CompilationResult {
            // Filter out completely empty results
            const validResults = results.filter(r => r.spec && Object.keys(r.spec).length > 0);
            
            if (validResults.length === 0) {
              return {};
            }
          
            // Collect all params from all results (including nested ones in layers)
            const allParams = validResults.flatMap(result => {
              const topLevelParams = result.spec?.params || [];
              const layerParams = result.spec?.layer?.flatMap(layer => layer.params || []) || [];
              return [...topLevelParams, ...layerParams];
            });
          
            // The first result should be the component's own result
            const componentResult = validResults[0];
            const childResults = validResults.slice(1);
            
            // Check which specs (including component) have marks or layers
            const hasMarks = validResults.filter(r => r.spec?.mark || r.spec?.layer);
          
            let mergedSpec;
            if (hasMarks.length <= 1) {
              // If only component result or one total mark-based spec, merge normally
              mergedSpec = validResults.reduce((merged, result) => ({
                ...merged,
                ...result.spec,
                transform: [...(merged.transform || []), ...(result.spec?.transform || [])]
              }), {});
            } else {
              // Multiple mark-based specs need layers
              const { width, height, data, ...restComponentSpec } = componentResult.spec;
              
              mergedSpec = {
                // Keep top-level properties from component result
                width,
                height,
                // Create layers from all specs with marks
                layer: hasMarks.map(r => {
                  const { params, width, height,  $schema, ...specWithoutParams } = r.spec;
                  return specWithoutParams;
                })
              };
            }
          
            // Remove params from nested specs
            if (mergedSpec.layer) {
              mergedSpec.layer = mergedSpec.layer.map(layerSpec => {
                const { params, ...restSpec } = layerSpec;
                return restSpec;
              });
            }
            delete mergedSpec.params;
          
            // Return final result with all params at top level
            return {
              spec: {
                ...mergedSpec,
                params: allParams
              }
            };
          }
      
        public compile(rootComponent: BaseComponent): TopLevelSpec {
            console.log('rootComponent', rootComponent,this, this.bindingGraph)
          const context: CompilationContext = {
            bindings: this.bindingStore.getDefaultGraph().getBindings(),
            compiledComponents: new Set()
          };
      

          // Get merged compilation result
          const mergedResult = this.compileComponent(rootComponent, context);
      
          console.log('mergedResult',mergedResult);
          // Create final spec
          return {
            "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
            ...(mergedResult.spec || {})
          };
        }
      
        private compileComponent(
          component: BaseComponent,
          context: CompilationContext,
          parentInfo?: ParentInfo
        ): CompilationResult {
          if (context.compiledComponents.has(component.id)) {
            return {};
          }
      
          context.compiledComponents.add(component.id);
      
          // Get this component's compilation result
          const componentResult = component.compileComponent(context, parentInfo);
      
          // Get and compile all children
          const childBindings = context.bindings.filter(b =>
            b.source.componentId === component.id
          );
      
          const childResults = childBindings.map(binding => {
            const childComponent = this.getComponent(binding.target.componentId);
            if (!childComponent) return {};
      
            const childParentInfo: ParentInfo = {
              boundAnchor: this.getAnchor(binding),
              parentComponent: component
            };
      
            return this.compileComponent(childComponent, context, childParentInfo);
          });

          console.log('componentResult',componentResult);
          console.log('childResults',childResults);
      
          // Merge this component's result with all child results
          return this.mergeResults(componentResult, ...childResults);
        }
      
        public getComponent(componentId: string): BaseComponent | undefined {
          return this.bindingStore.getComponent(componentId);
        }
      
        private getAnchor(binding: Binding): AnchorProxy {
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