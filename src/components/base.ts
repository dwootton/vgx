import { Field } from 'vega-lite/build/src/channeldef';
import { TopLevelSpec, UnitSpec } from 'vega-lite/build/src/spec';
import { generateId } from '../utils/id';
import { AnchorValue } from 'vega';
import { AnchorGroupSchema, AnchorProxy, AnchorSchema, AnchorType } from '../types/anchors';
import { createAnchorProxy } from '../utils/anchorProxy';
import { isComponent } from '../utils/component';
import { BindingManager } from '../binding/BindingManager';
import { compilationContext } from '../binding/binding';
import { generateComponentSignalName } from './marks/circle';
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


  

  protected createAnchorProxy(anchor: AnchorSchema,compileFn?:()=>string): AnchorProxy {
    return createAnchorProxy(this, anchor,compileFn);
  }

  abstract compileComponent(inputContext: compilationContext): Partial<UnitSpec<Field>>;

  // whenever compile is called, we go to the root and then compile the entire binding tree
  compile(): TopLevelSpec {

    return this.bindingManager.compile(this.id) as TopLevelSpec;
  }
}

