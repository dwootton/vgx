import { BindingTarget } from "../components/base";
import { isComponent } from "./component";

import { AnchorSchema, AnchorProxy, AnchorType, AnchorGroupSchema } from '../types/anchors';
import { BaseComponent } from '../components/base';
import { BindingManager, BindingEdge } from '../binding/BindingManager';
import { generateComponentSignalName } from "./component";
import { generateParams } from "./compilation"


export function isAnchorProxy(value: any): value is AnchorProxy {
  return typeof value === 'object' && 'bind' in value && 'anchorSchema' in value;
}

export function createAnchorProxy(component: BaseComponent, anchor: AnchorSchema, compileFn?: (nodeId?:string) => {source:string,value:any}): AnchorProxy {
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

  if (!compileFn && anchor.type != 'group') {
    throw new Error(`Compile function is required for an anchor proxy ${anchor.id} ${component.id}`)
  }

  return {
    id: { componentId: component.id, anchorId: anchor.id },
    component,
    bind: bindFn,
    anchorSchema: anchor,
    compile: compileFn || (() => ({source:'baseContext',value:''}))
  };
}
//TODO: make sure that the interactive data "bubbles up", when anchors are bound.


export function generateAnchorsFromContext(context: Record<AnchorType, any>, baseContext: Record<AnchorType, any>, component: BaseComponent, metaContext: any = {}) {
  const anchors = new Map<string, AnchorProxy>();

  
  Object.entries(baseContext).forEach(([key, value]) => {
    const anchorSchema = {
      id: `${key}`,
      type: key as AnchorType,
      interactive: metaContext[key]?.interactive || false
    }

    const compileFn = (nodeId?: string) => {
      if (!nodeId) {
        nodeId = component.id
      }
        value =  {fieldValue:`${(nodeId)}.${key}`};
        return {source:'generated',value}
      
    }
    anchors.set(key, createAnchorProxy(component, anchorSchema, compileFn));
  });
  return anchors;
}


export function getProxyAnchor(edge: BindingEdge, sourceComponent: BaseComponent | undefined) {
  if (!sourceComponent) {
      throw new Error(`Component "${edge.source.nodeId}" not added to binding manager`);
  }
  const sourceAnchor = edge.source.anchorId;
  return sourceComponent.getAnchor(sourceAnchor);
}


export function expandGroupAnchors(edge: AnchorProxy, component: BaseComponent | undefined) {
  if (!component) {
      throw new Error(`Component "${edge.id}" not added to binding manager`);
  }
  // for each edge, expand it (e iteratively go through and expand out any group anchors)
  const edges: AnchorProxy[] =[];
  const anchorSchema = edge.anchorSchema;
  if (anchorSchema.type === 'group') {
      // get the children of the group
      const children = (anchorSchema as AnchorGroupSchema).children;
      // for each child, get the proxy anchor and add it to the edges
      console.log('children', children)
      children.forEach(anchorId => {
        console.log('component', component, 'anchorId', anchorId)
          const childProxy = component.getAnchor(anchorId);
          console.log('childProxy', childProxy)
          edges.push(childProxy);
      });
  } else {
    edges.push(edge);
  }
  return edges;
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
