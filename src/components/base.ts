import { Field } from 'vega-lite/build/src/channeldef';
import { TopLevelSpec, UnitSpec } from 'vega-lite/build/src/spec';
import { generateId } from '../utils/id';
import { AnchorValue } from 'vega';
import { AnchorGroupSchema, AnchorProxy, AnchorSchema, AnchorType } from '../types/anchors';
import { createAnchorProxy } from '../utils/anchorProxy';
import { isComponent } from '../utils/component';
import { BindingManager } from '../binding/BindingManager';
import { compilationContext } from '../binding/binding';
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
  constructor() {
    this.id = generateId();
    this.bindingManager = BindingManager.getInstance();
    this.bindingManager.addComponent(this);
  }

  public initializeAnchors() {

    const allAnchor: AnchorGroupSchema = {
      id: '_all',
      type: 'group',
      // map through all anchors and add their schemas to the children
      children: new Map(Array.from(this.anchors.entries()).map(([key, anchor]) => [key, anchor.anchorSchema]))
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
    if (!anchor) {
      throw new Error(`Anchor "${id}" not found`);
    }
    return anchor;
  }


  generateAnchorsFromContext(context: Record<AnchorType, any>) {
    const anchors = new Map<string, AnchorProxy>();

    Object.entries(context).forEach(([key, value]) => {
      const anchorSchema = {
        id: `${this.id}-${key}`,
        type: key as AnchorType,
      }
      anchors.set(key, this.createAnchorProxy(anchorSchema));
    });
    return anchors;
  }

  protected createAnchorProxy(anchor: AnchorSchema): AnchorProxy {
    return createAnchorProxy(this, anchor);
  }

  abstract compileComponent(inputContext: compilationContext): Partial<UnitSpec<Field>>;

  compile(): TopLevelSpec {
    const root = findRootComponent(this.bindingManager, this.id);
    console.log('root',root)
    return root.compileComponent({}) as TopLevelSpec;
  }
}



function findRootComponent(bindingManager: BindingManager, componentId: string): BaseComponent {
  const bindings = bindingManager.getBindingsForComponent(componentId);

  const sourceBindings = bindings.filter(binding => binding.targetId === componentId);
  for(const binding of sourceBindings){
    // if the called component is the target of the binding, then we need to find the source of the binding
    if(binding.targetId === componentId){
      const sourceId = binding.sourceId;
      return findRootComponent(bindingManager, sourceId);
    }
  }
  const component = bindingManager.getComponent(componentId);
  if(!component){
    throw new Error(`Component "${componentId}" not added to binding manager`);
  }
  return component;
}
