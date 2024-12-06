import { BindingTarget } from "../components/base";
import { isComponent } from "./component";

import { AnchorSchema, AnchorProxy, AnchorType } from '../types/anchors';
import { BaseComponent } from '../components/base';
import { BindingManager } from '../binding/BindingManager';
import { generateComponentSignalName } from "./component";
import { generateParams } from "./compilation"


export function createAnchorProxy(component: BaseComponent, anchor: AnchorSchema,compileFn?:()=>string): AnchorProxy {
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

  if(!compileFn && anchor.type != 'group'){
    throw new Error(`Compile function is required for an anchor proxy ${anchor.id} ${component.id}`)
  } 

  return {
    id: { componentId: component.id, anchorId: anchor.id },
    component,
    bind: bindFn,
    anchorSchema: anchor,
    compile: compileFn || (() => '')
  };
}


export function generateAnchorsFromContext(context: Record<AnchorType, any>, component:BaseComponent, metaContext:any={}) {
    const anchors = new Map<string, AnchorProxy>();
  
    console.log('meta',metaContext)
    Object.entries(context).forEach(([key, value]) => {
      const anchorSchema = {
        id: `${key}`,
        type: key as AnchorType,
        interactive: metaContext[key]?.interactive || false
      }
      const compileFn= () => {
        return `${generateComponentSignalName(component.id)}.${key}`;
      }
      anchors.set(key, createAnchorProxy(component,anchorSchema,compileFn));
    });
    return anchors;
  }