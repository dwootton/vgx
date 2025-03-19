import { Field } from 'vega-lite/build/src/channeldef';
import { TopLevelSpec, UnitSpec } from 'vega-lite/build/src/spec';
import { generateId } from '../utils/id';
import { AnchorValue } from 'vega';
import {  AnchorProxy, AnchorSchema, AnchorIdentifer, SchemaType, SchemaValue } from '../types/anchors';
import { createAnchorProxy, isAnchorProxy } from '../utils/anchorProxy';
import { isComponent } from '../utils/component';
import { BindingManager, VirtualBindingEdge } from '../binding/BindingManager';
import { compilationContext } from '../binding/binding';
// import { generateComponentSignalName } from './marks/circle';
export type BindingTarget = BaseComponent | AnchorProxy;
export interface Component {
  id: string;
  type: string;
  getSpec(): any;
}


export abstract class BaseComponent {
  protected anchors: Map<string, AnchorProxy> = new Map();
  public schema: Record<string, SchemaType> = {}; // default?
  public configurations: Record<string, SchemaType> = {};

  public id: string;
  public bindingManager: BindingManager;

  


  constructor(config: any) {
    this.id = generateId();

    this.bindingManager = BindingManager.getInstance();
    this.bindingManager.addComponent(this);

    const bindings = findBindings(config);
    bindings.length && this.addParameterBindings(bindings);
  }

  public addContextBinding(channelName: string, contextValue: any, contextType: 'context' | 'baseContext' = 'context') {
    // Create a virtual binding edge that represents a context input
    const virtualEdge: VirtualBindingEdge = {
      channel: channelName,
      value: contextValue,
      source: contextType
    };

    // Add to binding manager with high priority
    this.bindingManager.addVirtualBinding(channelName, virtualEdge);
  }

  private addParameterBindings(bindings: { value: BaseComponent | AnchorProxy, key: string }[]) {
    function getTargetId(binding: BaseComponent | AnchorProxy): string {
      return isComponent(binding) ? binding.id : (binding as AnchorProxy).id.componentId;
    }
    console.log('bindings', bindings)

    function isAllBind(key:string){
      return key === 'bind' || /^bind\[\d+\]$/.test(key)
    }


    bindings.forEach(({ value: binding, key }) => {
      const bindingProperty = key.startsWith('bind.') ? key.split('.')[1] : (isAllBind(key) ? '_all' : key);

      // TODO interactive binding reversal– this may be not needed depending on how scalar:scalar is handled
      if(bindingProperty === '_all'){

        // go through all target anchors, and if any are interactive, add a binding to the inverse
        if(isComponent(binding)){
        binding.anchors.forEach((anchor) => {

          // Check if the anchor has an anchorSchema with properties
          if (anchor.anchorSchema) {
            // Iterate through each property in the anchorSchema
            Object.keys(anchor.anchorSchema).forEach(key => {

              const schema = anchor.anchorSchema[key];

              // Check if the schema has an interactive property and it's true
              if (schema && schema.interactive) {
                // Add the inverse binding - from the target component back to this component
                this.bindingManager.addBinding(getTargetId(binding), this.id, anchor.id.anchorId, anchor.id.anchorId);
              }
            });
          }
          // //@ts-ignore
          // if(anchor.anchorSchema.interactive){
          //   this.bindingManager.addBinding(getTargetId(binding),this.id, anchor.id.anchorId, anchor.id.anchorId);
          // }
        })
      }

      } 
      
      function getConfigurationId(bindingProperty: string){
        const split = bindingProperty.split('.')
        // If no configuration id is provided, return 'span' as default
        // In the future, we could grab the first id from default configurations
        // return split[1] || configurations[0].id
        return 'span'
      }

      // Check if this is a BaseChart by using instanceof or checking for chart-specific properties
      const isParentChart = ['Scatterplot','Histogram','BarChart'].includes(this.constructor.name);

      if (isComponent(binding)) {
        this.bindingManager.addBinding(this.id, getTargetId(binding), bindingProperty, '_all');

        // TODO interactive binding reversal– this may be not needed depending on how scalar:scalar is handled
        binding.anchors.forEach((anchor) => {

          const anchorSchema = Object.values(anchor.anchorSchema)[0];
          if(anchorSchema && anchorSchema.interactive && !isParentChart){ // TODO FIX such that chart isn't ddded...

            this.bindingManager.addBinding(getTargetId(binding),this.id, anchor.id.anchorId, bindingProperty);
          }
        })

      } else {
        // TODO: i think intertactiveity is not populating up and thus we don't get the inversee/internal stuff. 
        this.bindingManager.addBinding(this.id, getTargetId(binding), bindingProperty, binding.id.anchorId);
        if (binding.anchorSchema.interactive && !isParentChart) {

          this.bindingManager.addBinding(getTargetId(binding), this.id, binding.id.anchorId, binding.id.anchorId);
        }
      }

    });
  }

  //   public createGroupAnchor(groupName: string, children: string[]) {
  //     this.anchors.set(groupName, {
  //         id: { componentId: this.id, anchorId: groupName },
  //         component: this,
  //         anchorSchema: {
  //             id: groupName, 
  //             type: 'group',
  //             children: children,
  //             interactive: false // Group anchors are always not interactive
  //         },
  //         bind: (target: any) => {
  //             children.forEach(child => 
  //                 this.anchors.get(child)?.bind(target)
  //             );
  //             return this;
  //         },
  //         // group anchors never get compiled as they are expanded
  //         compile: (nodeId?: string)=>{
  //             console.error('Group anchor was compiled', groupName, nodeId)
  //             return {source: 'group',
  //             value: "empty"}
  //         }
  //     });
  // }

  public initializeAnchors() {
  
    this.anchors.set('_all', this.createAnchorProxy({}, '_all', () => {
      return { source: '', value: '' }
    }));
  }

  // This is the top-level bind function that redirects to _all anchor
  // it is only called if bind is called on a component
  bind(target: BaseComponent | AnchorProxy): BaseComponent {
    // If target is a component, use its _all anchor
    const targetAnchor = isComponent(target)
      ? target.getAnchor('_all')
      : target;

    // Redirect binding to our _all anchor
    return this.getAnchor('_all').bind(targetAnchor);
  }

  // Protected method to get anchor (used by bind)
  public getAnchor(id: string): AnchorProxy {
    const anchor = this.anchors.get(id);
    if (!anchor) {
      throw new Error(`Anchor "${id}" not found`);
    }
    return anchor;
  }

  public getAnchors(): AnchorProxy[] {
    return Array.from(this.anchors.values());
  }

  public setAnchor(anchorId: string, anchor: AnchorProxy) {
    this.anchors.set(anchorId, anchor);
  }




  protected createAnchorProxy(anchor: AnchorSchema, anchorId: string, compileFn?: (nodeId?: string) => SchemaValue): AnchorProxy {
    return createAnchorProxy(this, anchor, anchorId, compileFn);
  }

  abstract compileComponent(inputContext: compilationContext): Partial<UnitSpec<Field>>;

  // whenever compile is called, we go to the root and then compile the entire binding tree
  compile(): TopLevelSpec {

    return this.bindingManager.compile(this.id) as TopLevelSpec;
  }
}

const findBindings = (value: any, path: string = ''): { value: BaseComponent | AnchorProxy, key: string }[] => {
  if (!value) return [];

  // Handle arrays, but skip if path is 'data'
  if (Array.isArray(value) && path !== 'data') {
    return value.flatMap((item, index) => findBindings(item, `${path}[${index}]`));
  }

  // Only match if value is a Component or AnchorProxy
  if (isComponent(value)) {
    return [{ value, key: path }];
  }

  // Check for AnchorProxy by looking for bind method and anchorSchema property
  if (isAnchorProxy(value)) {
    return [{ value, key: path }];
  }

  // If not a direct match but is an object, check its properties
  if (typeof value === 'object' && path !== 'data') {
    return Object.entries(value).flatMap(([key, v]) =>
      findBindings(v, path ? `${path}.${key}` : key)
    );
  }

  return [];
};