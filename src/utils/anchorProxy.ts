import { BindingTarget } from "../components/base";
import { isComponent } from "./component";

import {  AnchorProxy, AnchorType, AnchorSchema, SchemaValue } from '../types/anchors';
import { BaseComponent } from '../components/base';
import { BindingManager, BindingEdge } from '../binding/BindingManager';
import { generateComponentSignalName } from "./component";
import { generateParams } from "./compilation"
import { isChannel } from "vega-lite/build/src/channel";


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
  // console.log('anchorProxy', proxy);
  return proxy;
}
//TODO: make sure that the interactive data "bubbles up", when anchors are bound.




// export function generateAnchorsFromContext( baseContext: Record<AnchorType, any>, component: BaseComponent, metaContext: any = {}) {
//   const anchors = new Map<string, AnchorProxy>();

  
//   function processNestedObject(obj: any, prefix: string = '', metaContext: any = {}) {
//     Object.entries(obj).forEach(([key, value]) => {
//       const fullKey = prefix ? `${prefix}_${key}` : key;
      
//       if (value && typeof value === 'object' && !Array.isArray(value)) {
//         // Recursively process nested objects
//         processNestedObject(value, fullKey, metaContext?.[key] || {});
//       } else {
//         // Create anchor for leaf node
//         const anchorType = isChannel(key) ? 'encoding' : 'info';

//         const anchorSchema = {
//           id: fullKey,
//           type: anchorType,
//           interactive: prefix 
//             ? metaContext?.[key]?.interactive || false
//             : metaContext[key]?.interactive || false
//         } as AnchorSchema

//         const compileFn = (nodeId?: string) => {
//           if (!nodeId) {
//             nodeId = component.id
//           }
//           value = {fieldValue: `${nodeId}.${fullKey}`};
//           return {source: 'generated', value}
//         }

//         anchors.set(fullKey, createAnchorProxy(component, anchorSchema, compileFn));
//       }
//     });
//   }

//   processNestedObject(baseContext, '', metaContext);
//   return anchors;
// }


export function getProxyAnchor(edge: BindingEdge, sourceComponent: BaseComponent | undefined) {
  if (!sourceComponent) {
      throw new Error(`Component "${edge.source.nodeId}" not added to binding manager`);
  }
  const sourceAnchor = edge.source.anchorId;
  return sourceComponent.getAnchor(sourceAnchor);
}


// export function expandGroupAnchors(edge: AnchorProxy, component: BaseComponent | undefined) {
//   if (!component) {
//       throw new Error(`Component "${edge.id}" not added to binding manager`);
//   }
//   // for each edge, expand it (e iteratively go through and expand out any group anchors)
//   const edges: AnchorProxy[] =[];
//   const anchorSchema = edge.anchorSchema;
//   if (anchorSchema.type === 'group') {
//       // get the children of the group
//       const children = (anchorSchema as AnchorGroupSchema).children;
//       // for each child, get the proxy anchor and add it to the edges
//       children.forEach(anchorId => {
//           const childProxy = component.getAnchor(anchorId);
//           edges.push(childProxy);
//       });
//   } else {
//     edges.push(edge);
//   }
//   return edges;
// // }

// export function expandGroupAnchors(
//   edge: EnhancedBindingEdge,
//   component: BaseComponent
// ): EnhancedBindingEdge[] {
//   const { originalEdge, anchorProxy } = edge;
//   const schema = anchorProxy.anchorSchema;
  
//   if (schema.type === 'group') {
//       return schema.children.map(childId => ({
//           originalEdge,
//           anchorProxy: component.getAnchor(childId)
//       }));
//   }
//   return [edge];
// }

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
