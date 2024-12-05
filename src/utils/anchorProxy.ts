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

// export function createAnchorProxy(anchor: AnchorSchema, component: BaseComponent): AnchorProxy {
//     // bind function that will be used if called on a specific anchor (chart.x.bind....)
//     const bindFn = (target:  BindingTarget) => {
      
//       // If target is a component, use its _all anchor
//       const targetAnchor = isComponent(target) 
//         ? target.getAnchor('_all')
//         : target;

//       // Get the binding graph
//       const bindingManager = BindingManager.getInstance();

//       // Add the binding
//       bindingManager.addBinding(
//         this.id,targetAnchor.id.componentId, anchor.id,
//         targetAnchor.id.anchorId
//       );

//       //chart._all.bind(brush._all

//       return targetAnchor.component;
//     };

//     return {
//       id: { componentId: this.id, anchorId: anchor.id },
//       component: this,
//       bind: bindFn,
//       anchorSchema: anchor
//     };
//   }