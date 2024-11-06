// import { Anchor, AnchorOrGroup, AnchorProxy } from '../types/anchors';
// import { BindingGraph } from '../utils/bindingGraph';
// import { generateId } from '../utils/id';

// export interface Component {
//   id: string;
//   type: string;
//   anchors: Map<string, AnchorOrGroup>;
//   getSpec(): any;
// }


// export abstract class BaseComponent {
//   id: string;
//   private rawAnchors: Map<string, AnchorOrGroup> = new Map();
//   protected anchors: Map<string, AnchorProxy> = new Map();

//   protected bindingGraph!: BindingGraph;

//   constructor() {
//     this.id = `component_${Date.now()}_${Math.random()}`;

//     // Return a proxy for the component that handles property access
    // return new Proxy(this, {
    //   get: (target, prop: string) => {
    //     // If it's a normal property/method, return it
    //     if (prop in target) {
    //       return target[prop as keyof typeof target];
    //     }
    //     // If it's an anchor name, return its proxy
    //     if (target.anchors.has(prop)) {
    //       return target.anchors.get(prop);
    //     }
    //   }
    // });
//   }
//   // Generate scoped anchor IDs
//   public generateAnchorId(name: string): string {
//     return `${name}`; // e.g., "brush_123:topLeft"
//   }


//   protected createAnchorProxy(anchor: AnchorOrGroup): AnchorProxy {
//     // Create the bind function
//     const bindFn = (targetAnchor: AnchorProxy) => {
//       if (!targetAnchor?.component || !targetAnchor?.id) {
//         throw new Error('Invalid binding target');
//       }

//       this.bindingGraph.addBinding(
//         this.id,
//         anchor.id,
//         targetAnchor.component.id, //component ID
//         targetAnchor.id //anchor ID
//       );

//       return targetAnchor.component;
//     };


//     ////TODO
//     // so I need to figure out how to store the binding graph 
//     // should it be one per component? one per chart? and if so, how is it accessed within bindFn?
//     // I'll likely also need to double check the logic for naming the binding graph keys and think about what 
//     // they need to not be duplicated, but also be accessible (ie chart.x.bind(....))

//     const bindFninOgproxy = (targetAnchor: any) => {
//       console.log('in og proxy bind')
//       return targetAnchor.component;
//     };

//     const proxyObj = {
//           id: anchor.id,
//           component: this,
//           bind: bindFninOgproxy,
//           // Add other anchor properties
//         };

//         // add to top level properties
    
//     // Return proxy that handles both function access and property access
//     return new Proxy(proxyObj, {
//       get: (source, prop) => {
//         if (prop === 'bind') {
//           // actually call the bind function
//           console.log('bind called from:', source);
//           return (target: AnchorProxy)=>bindFn(target);
//         }
//         if (prop === 'component') return this;
        
//         // Get raw anchor data for other property access

//         return anchor?.[prop as keyof AnchorOrGroup];
//       }
//     });
//   }

  
//   protected getRawAnchor(anchorId: string): AnchorOrGroup | undefined {
//     return this.rawAnchors.get(anchorId);
//   }

//   protected setRawAnchor(anchorId: string, anchor: AnchorOrGroup) {
//     this.rawAnchors.set(anchorId, anchor);
//     // Create/update proxy when setting raw anchor
//     this.createAnchorProxy(anchor);
//   }

//   // Example usage of getting bindings for a component
//   getBindings() {
//     return {
//       all: this.bindingGraph.getBindings(this.id),
//       asSource: this.bindingGraph.getSourceBindings(this.id),
//       asTarget: this.bindingGraph.getTargetBindings(this.id)
//     };
//   }
// }