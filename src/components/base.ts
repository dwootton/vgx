import { Field } from 'vega-lite/build/src/channeldef';
import { TopLevelSpec, UnitSpec } from 'vega-lite/build/src/spec';
import { generateId } from '../utils/id';
import { AnchorValue } from 'vega';
import { AnchorGroupSchema, AnchorId, AnchorProxy, AnchorSchema, AnchorIdentifer, AnchorOrGroupSchema } from '../types/anchors';
import { createAnchorProxy, isAnchorProxy } from '../utils/anchorProxy';
import { isComponent } from '../utils/component';
import { BindingManager,VirtualBindingEdge } from '../binding/BindingManager';
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
    

    bindings.forEach(({ value: binding, key }) => {
      const bindingProperty = key == 'bind' ? '_all' : key;
      console.log('bindingProperty', bindingProperty)

      if(bindingProperty === '_all'){

        console.log('binding all', binding)
        // go through all target anchors, and if any are interactive, add a binding to the inverse
        if(isComponent(binding)){
        binding.anchors.forEach((anchor) => {
          //@ts-ignore
          if(anchor.anchorSchema.interactive){
            this.bindingManager.addBinding(getTargetId(binding),this.id, anchor.id.anchorId, anchor.id.anchorId);
          }
        })
      }

      }
      
      if(isComponent(binding)){
        console.log('binding', binding)
        this.bindingManager.addBinding(this.id, getTargetId(binding), bindingProperty, '_all');
        binding.anchors.forEach((anchor) => {
          if(anchor.anchorSchema.interactive){
            console.log('interactive2', binding)

            this.bindingManager.addBinding(getTargetId(binding),this.id, anchor.id.anchorId, anchor.id.anchorId);
          }
        })
       
      } else {
        console.log('not component', binding)
        this.bindingManager.addBinding(this.id, getTargetId(binding), bindingProperty, binding.id.anchorId);
        if(binding.anchorSchema.interactive){
          console.log('interactive', binding)
          this.bindingManager.addBinding(getTargetId(binding),this.id, binding.id.anchorId, binding.id.anchorId);
        }
      }
     
    });
  }

  public initializeAnchors() {
    const allAnchor: AnchorGroupSchema = {
      id: '_all',
      type: 'group',
      interactive: false, 
      // map through all anchors  dand add their schemas to the children
      children: Array.from(this.anchors.keys())
    };
    this.anchors.set('_all', this.createAnchorProxy(allAnchor));
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
    console.log('anchor', anchor, this.anchors, id)
    if (!anchor) {
      throw new Error(`Anchor "${id}" not found`);
    }
    return anchor;
  }




  protected createAnchorProxy(anchor: AnchorSchema, compileFn?: (nodeId?:string) => {source:string,value:any}): AnchorProxy {
    return createAnchorProxy(this, anchor, compileFn);
  }

  abstract compileComponent(inputContext: compilationContext): Partial<UnitSpec<Field>>;

  // whenever compile is called, we go to the root and then compile the entire binding tree
  compile(): TopLevelSpec {

    return this.bindingManager.compile(this.id) as TopLevelSpec;
  }
}

const findBindings = (value: any, path: string = ''): { value: BaseComponent | AnchorProxy, key: string }[] => {
  if (!value) return [];

  // Handle arrays
  if (Array.isArray(value)) {
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
  if (typeof value === 'object') {
    return Object.entries(value).flatMap(([key, v]) =>
      findBindings(v, path ? `${path}.${key}` : key)
    );
  }

  return [];
};