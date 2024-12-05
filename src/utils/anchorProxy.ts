import { BindingTarget } from "../components/base";
import { isComponent } from "./component";

import { AnchorSchema, AnchorProxy } from '../types/anchors';
import { BaseComponent } from '../components/base';
import { BindingManager } from '../binding/BindingManager';

export function createAnchorProxy(component: BaseComponent, anchor: AnchorSchema): AnchorProxy {
  const bindFn = (target: BindingTarget) => {
    const targetAnchor = isComponent(target) 
      ? target.getAnchor('_all')
      : target;

    const bindingManager = BindingManager.getInstance();
    bindingManager.addBinding(
      component.id, targetAnchor.id.componentId, anchor.id,
      targetAnchor.id.anchorId
    );

    return targetAnchor.component;
  };

  return {
    id: { componentId: component.id, anchorId: anchor.id },
    component,
    bind: bindFn,
    anchorSchema: anchor
  };
}
