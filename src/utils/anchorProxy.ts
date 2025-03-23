import { BindingTarget } from "../components/base";
import { isComponent } from "./component";

import {  AnchorProxy, AnchorType, AnchorSchema, SchemaValue } from '../types/anchors';
import { BaseComponent } from '../components/base';
import { BindingManager } from '../binding/BindingManager';
import { BindingEdge } from '../binding/GraphManager';


export function isAnchorProxy(value: any): value is AnchorProxy {
  return typeof value === 'object' && 'bind' in value && 'anchorSchema' in value;
}

export function createAnchorProxy(component: BaseComponent, anchor: AnchorSchema, anchorId:string, compileFn?: (nodeId?:string) => SchemaValue): AnchorProxy {
  const bindFn = (target: BindingTarget) => {
    const targetAnchor = isComponent(target)
      ? target.getAnchor('_all')
      : target;

    const bindingManager = BindingManager.getInstance();
    bindingManager.addBinding(
      component.id, targetAnchor.id.componentId, anchorId,
    targetAnchor.id.anchorId
    );

    return targetAnchor.component;
  };

  if (!compileFn ) {

    throw new Error(`Compile function is required for an anchor proxy ${anchorId} ${component.id}`)
  }

  const proxy = {
    id: { componentId: component.id, anchorId: anchorId },
    component,
    bind: bindFn,
    anchorSchema: anchor,
    compile: compileFn //|| (() => ({source:'baseContext',value:''}))// TODO change to regular schema type
  };
  return proxy;
}



export function getProxyAnchor(edge: BindingEdge, sourceComponent: BaseComponent | undefined) {
  if (!sourceComponent) {
      throw new Error(`Component "${edge.source.nodeId}" not added to binding manager`);
  }
  const sourceAnchor = edge.source.anchorId;
  return sourceComponent.getAnchor(sourceAnchor);
}

// Function to make properties bindable
export function anchorize<T extends object>(obj: T): T {
  const handler: ProxyHandler<T> = {
      get(target: T, prop: string | symbol): any {
          if (prop === 'bind') {
              return function (this: any, target: any) {
                  // Implement binding logic here
                  console.log(`Binding ${String(prop)} to`, target);
                  
              };
          }

          const value = target[prop as keyof T];
          if (typeof value === 'object' && value !== null) {
              return new Proxy(value as object, handler) as any;
          }

          return value;
      }
  };

  return new Proxy(obj, handler);
}
