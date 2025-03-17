import { BaseComponent } from "../components/base";
import { BindingManager } from "./BindingManager";
import { UnitSpec } from "vega-lite/build/src/spec";
import { Field } from "vega-lite/build/src/channeldef";
import { AnchorProxy, SchemaType } from "../types/anchors";
import { Constraint, ConstraintType, constraintToUpdateRule } from './constraints';
import { extractChannel, isCompatible } from "./cycles_CLEAN";

// Identifier for merged component signals in constraints
export const VGX_MERGED_SIGNAL_NAME = 'VGX_MERGED_SIGNAL_NAME';

// /**
//  * Creates a merged component to handle bidirectional constraints between two components.
//  * The merged component acts as a mediator that enforces all constraints in both directions.
//  * 
//  * @param node1Id First component ID in the cycle
//  * @param node2Id Second component ID in the cycle
//  * @param channel The channel/anchor ID that is part of the cycle
//  * @param bindingManager The binding manager instance
//  * @returns A new merged component
//  */
// export function createMergedComponent(
//   node1Id: string,
//   node2Id: string,
//   channel: string,
//   bindingManager: BindingManager
// ): BaseComponent {
//   const component1 = bindingManager.getComponent(node1Id);
//   const component2 = bindingManager.getComponent(node2Id);
  
//   if (!component1 || !component2) {
//     throw new Error(`Components not found: ${node1Id}, ${node2Id}`);
//   }
  
//   // Create the merged component
//   const mergedId = `merged_${node1Id}_${node2Id}_${channel}`;
//   const mergedSchema = component1.schema[channel]; 
  
//   class MergedComponent extends BaseComponent {
//     mergedComponent: boolean;
//     node1Id: string;
//     node2Id: string;
//     channel: string;
    
//     constructor() {
//       super({});
//       this.id = mergedId;
//       this.mergedComponent = true;
//       this.node1Id = node1Id;
//       this.node2Id = node2Id;
//       this.channel = channel;
      
//       // Set schema to match the involved components
//       this.schema = { [channel]: mergedSchema };
      
//       // Create an anchor that provides an absolute value
//       this.anchors.set(channel, this.createAnchorProxy(
//         { [channel]: this.schema[channel] },
//         channel,
//         () => ({ absoluteValue: `${this.id}` })
//       ));
//     }
    
//     /**
//      * Compiles the merged component into a Vega-Lite spec.
//      * The merged component creates a single signal that coordinates
//      * between the two original components, applying all constraints.
//      */
//     compileComponent(context: any): Partial<UnitSpec<Field>> {
//       // Extract merged signal constraints, if any
//       const mergedSignalConstraints = context['VGX_MERGED_SIGNAL_NAME'] || [];

      
//       // Create the merged signal with update rules
//       const mergedSignal = {
//         name: `${this.id}`,
//         value: 0,
//         on: this.buildUpdateRules(mergedSignalConstraints)
//       };
      
//       return {
//         params: [mergedSignal]
//       };
//     }
    
//     /**
//      * Builds update rules for the merged signal based on constraints.
//      */
//     private buildUpdateRules(constraintUpdates: any[]): any[] {
//       const updates: any[] = [];
      
//       // Flatten constraint updates if needed
//       const flatConstraints = Array.isArray(constraintUpdates[0]) 
//         ? constraintUpdates.flat() 
//         : constraintUpdates;

      
//       // Apply each constraint as an update rule
//       flatConstraints.forEach(constraint => {
//         if (constraint && constraint.events && constraint.update) {
//           // Extract signal names from update expression
//           const signalNames = extractSignalNames(constraint.update);
          
//           // Create event triggers for each signal
//           const events = signalNames.map(name => ({ signal: name }));
          
//           // Add update rule
//           updates.push({
//             events,
//             update: constraint.update
//           });
//         }
//       });
      
//       return updates;
//     }
//   }
  
//   return new MergedComponent();
// }

/**
 * Extracts node signal names from an update expression.
 */
export function extractSignalNames(updateExpr: string): string[] {
  // This is a simplified implementation - in practice, you would
  // use a more sophisticated parser to extract signal references
  const signalRegex = /\b(\w+)_(\w+)(?:_internal)?\b/g;
  const matches = updateExpr.match(signalRegex) || [];
  return [...new Set(matches)]; // Deduplicate
}

// /**
//  * Extracts and processes constraints for merged components.
//  * This function gathers constraints from all components in the cycle
//  * and transforms them so they can be applied bidirectionally.
//  */
// export function extractConstraintsForMergedComponent(
//   parentAnchors: { anchor: AnchorProxy, targetId: string }[],
//   constraintsByNode: Record<string, Record<string, Constraint[]>>,
//   component: BaseComponent
// ): Constraint[] {
//   // Extract parent component IDs
//   const parentComponentIds = parentAnchors.map(
//     anchor => anchor.anchor.id.componentId
//   );
  
//   const mergedConstraints: Constraint[] = [];
  
//   // For each parent component
//   parentComponentIds.forEach(parentId => {
//     // Get the anchor from this parent that feeds the merged component
//     const anchorFromParent = parentAnchors.find(
//       anchor => anchor.anchor.id.componentId === parentId
//     );
    
//     if (!anchorFromParent) return;
    
//     // Get parent internal signal name
//     const internalSignal = `${parentId}_${anchorFromParent.targetId}_internal`;
    
//     // Get other parents
//     const otherParentIds = parentComponentIds.filter(id => id !== parentId);
    
//     // Apply constraints from other parents using this parent's signal
//     otherParentIds.forEach(otherParentId => {
//       const otherConstraints = constraintsByNode[otherParentId];
//       if (!otherConstraints) return;
      
//       const channel = component.getAnchors()[0]?.id.anchorId;
//       if (!channel) return;
      
//       // Get constraints for the internal signal
//       const internalConstraints = otherConstraints[`${channel}_internal`] || [];
      
//       // Transform constraints to use parent's signal
//       internalConstraints.forEach(constraint => {
//         // Clone the constraint but change the source signal
//         const transformedConstraint: Constraint = {
//           ...constraint,
//           sourceSignal: internalSignal
//         };
        
//         mergedConstraints.push(transformedConstraint);
//       });
//     });
//   });
  
//   return mergedConstraints;
// } 


// export function extractConstraintsForMergedComponent(parentAnchors: { anchor: AnchorProxy, targetId: string }[], compileConstraints: Record<string, any>, component: BaseComponent) {
//     // Get all parent components that feed into this merged component
//     const parentComponentIds = parentAnchors.map(anchor => anchor.anchor.id.componentId);

//     const mergedSignals = []

//     // For each input into the merged component, get what their constraints were so they can be applied to the other update statements
//     parentComponentIds.forEach(parentId => {

//         const parentConstraints = compileConstraints[parentId];
//         // find the 
//         // if (!parentConstraints) {
//         //     console.log(`No constraints found for parent component ${parentId}`);
//         //     return;
//         // }



//         // Get the anchors from this parent that feed into the merged component
//         const anchorFromParent = parentAnchors.find(anchor => anchor.anchor.id.componentId == parentId);// || [];


//         if (!anchorFromParent) {
//             console.log(`No anchor found for parent component ${parentId}`);
//             return;
//         }

//         const parentSignalName = `${parentId}_${anchorFromParent.targetId}_internal`;

//         // For each other parent component, get its constraints
//         const otherParentIds = parentComponentIds.filter(id => id !== parentId);

//         // Get constraints for each other parent
//         const otherParentsConstraints = otherParentIds.map(otherParentId => {
//             const otherParentIdInternal = otherParentId;//+"_internal";
//             const otherParentConstraints = compileConstraints[otherParentIdInternal];
//             if (!otherParentConstraints) {
//                 console.log(`No constraints found for other parent component ${otherParentId}`);
//                 return null;
//             }



//             // Okay, so at this point we need to go through and clone each of the other constraints and add
//             // an update from them 
//             // const parentSignalName = `${parentId}_${anchorFromParent.targetId}`;

//             const channel = component.getAnchors()[0].id.anchorId;

//             const constraints = (otherParentConstraints[`${channel}_internal`] || ["VGX_SIGNAL_NAME"]).map(constraint => {
//                 return {
//                     events: { "signal": parentSignalName },

//                     update: constraint.replace(/VGX_SIGNAL_NAME/g, parentSignalName)
//                 }
//             })




//             return constraints

//         }).filter(item => item !== null);

//         mergedSignals.push(...otherParentsConstraints)


//     })

//     return mergedSignals
// }


/**
 * Extract constraints for a merged component from all parent components
 */
export function extractConstraintsForMergedComponent(
    parentAnchors: { anchor: AnchorProxy, targetId: string }[], 
    compileConstraints: Record<string, any>, 
    component: BaseComponent
  ) {
    // Get all parent components that feed into this merged component
    const parentComponentIds = parentAnchors.map(anchor => anchor.anchor.id.componentId);
    const mergedSignals: any[] = [];

  
    // For each input component in the cycle
    parentAnchors.forEach(anchorFromParent => {
        const parentId = anchorFromParent.anchor.id.componentId
      
     
        if (!anchorFromParent) {
            return;
        }

    
      const parentSignalName = `${parentId}_${anchorFromParent.anchor.id.anchorId}_internal`
      console.log('parentSignalName', parentSignalName)
     
      // Get all other components in the cycle
      const otherParentIds = parentComponentIds.filter(id => id !== parentId);
  
      console.log('internalConstraints otherParentIds', otherParentIds)
      // Process constraints from each other parent
      const otherParentsConstraints = otherParentIds.map(otherParentId => {
        const otherParentConstraints = compileConstraints[otherParentId];
        
        if (!otherParentConstraints) {
          console.warn(`No constraints found for other parent component ${otherParentId}`);
          return null;
        }
  
        // Get the base channel from the merged component
        const channel = component.getAnchors()[0]?.id.anchorId;
        if (!channel) return null;

        console.log('internalConstraintsdassda',otherParentConstraints)

        const internalConstraints = Object.keys(otherParentConstraints).filter(key => key.endsWith('_internal')).filter(key=>isCompatible(key.replace('_internal', ''), channel))

        console.log('internalConstraintsdassda2', internalConstraints)
        // if no interna constraints it means it didn't have any other constraints
        if(internalConstraints.length === 0) {
            console.log('returning baseconstraint')
            return {
                events: { "signal": parentSignalName },
                update: parentSignalName
              };
            
        }
  
        // Create constraints that update based on this parent's signal
        const constraints = internalConstraints
            .map(internalKeys => {
                // Okay, so currently we're getting a bit weird behavior: like clamp(node_2_point_x_internal,node_2_begin_x,node_2_begin_x)
                // so we'll want to do something around no-self-node constraints (maybe), and I'll need to figure out why 
                // valid constraints like the scales are not being passed.
                // I think has to deal with the merge constraints logic...
                
                const constraints = otherParentConstraints[internalKeys]
                console.log('constraint COMPONTNETANCHOR', anchorFromParent.anchor.id.componentId)
                return constraints.map(constraint => {
                    console.log('in self reference?', constraint,constraint.includes(anchorFromParent.anchor.id.componentId))
                    if(constraint.includes('undefined') || constraint.includes(anchorFromParent.anchor.id.componentId)) return null;
                    return {
                        events: { "signal": parentSignalName },
                        update: constraint.replace(/VGX_SIGNAL_NAME/g, parentSignalName)
                      }
                }).filter(item => item !== null)
             
            })

        console.log("COMPILEDCONSTRAINTS1", constraints)
        return constraints.flat();
      }).filter(item => item !== null).flat();

      console.log("COMPILEDCONSTRAINTS2", otherParentsConstraints)
  
      mergedSignals.push(...otherParentsConstraints);
    });

    console.log("COMPILEDCONSTRAINTS3", mergedSignals)
  
    return mergedSignals;
  }

  /**
 * Creates a merged component to handle bidirectional constraints between multiple components.
 * The merged component acts as a mediator that enforces all constraints across all connected nodes.
 * 
 * @param nodeIds Array of component IDs in the cycle
 * @param channel The channel that is part of the cycle (e.g., 'x', 'y', 'color')
 * @param bindingManager The binding manager instance
 * @returns A new merged component
 */
export function createMergedComponentForChannel(
    nodeIds: string[],
    channel: string,
    bindingManager: BindingManager
  ): BaseComponent {
    // Get all components from IDs and filter out any that don't exist
    const components = nodeIds
      .map(id => bindingManager.getComponent(id))
      .filter(Boolean) as BaseComponent[];
    
    if (components.length === 0) {
      throw new Error(`No valid components found for nodes: ${nodeIds.join(', ')}`);
    }
    
    // Find a component that has a schema for this channel by checking all schema keys
    const schemaComponent = components.find(c => {
      if (!c.schema) return false;
      
      // Look for schema keys that contain this channel
      return Object.keys(c.schema).some(key => {
        const extractedChannel = extractChannel(key);
        return extractedChannel === channel;
      });
    });
    
    if (!schemaComponent) {
      throw new Error(`No component has schema for channel ${channel}`);
    }
    
    // Create the merged component ID
    const mergedId = `merged_${nodeIds.join('_')}_${channel}`;
    
    // Use schema from the component we found
    const mergedSchema = schemaComponent.schema[channel];
    
    class MergedComponent extends BaseComponent {
      mergedComponent: boolean;
      nodeIds: string[];
      channel: string;
      
      constructor() {
        super({});
        this.id = mergedId;
        this.mergedComponent = true;
        this.nodeIds = nodeIds;
        this.channel = channel;
        
        // Set schema to match the involved components
        this.schema = { [channel]: mergedSchema };
        
        // Create an anchor that provides an absolute value
        this.anchors.set(channel, this.createAnchorProxy(
          { [channel]: this.schema[channel] },
          channel,
          () => ({ absoluteValue: `${this.id}` })
        ));
        
        // Create individual anchors for each connected node
        nodeIds.forEach(nodeId => {
          const nodeAnchorId = `${nodeId}_${channel}`;
          this.anchors.set(nodeAnchorId, this.createAnchorProxy(
            { [channel]: this.schema[channel] },
            nodeAnchorId,
            () => ({ absoluteValue: `${this.id}` })
          ));
        });
      }
      
      /**
       * Compiles the merged component into a Vega-Lite spec.
       * The merged component creates a single signal that coordinates
       * between all original components, applying all constraints.
       */
      compileComponent(context: any): Partial<UnitSpec<Field>> {
        // Extract merged signal constraints, if any
        const mergedSignalConstraints = context['VGX_MERGED_SIGNAL_NAME'] || [];
        
        // Create the merged signal with update rules
        const mergedSignal = {
          name: `${this.id}`,
          value: 0,
          on: this.buildUpdateRules(mergedSignalConstraints)
        };
        
        return {
          params: [mergedSignal]
        };
      }
      
      /**
       * Builds update rules for the merged signal based on constraints.
       */
      private buildUpdateRules(constraintUpdates: any[]): any[] {
        const updates: any[] = [];
        
        // Flatten constraint updates if needed
        const flatConstraints = Array.isArray(constraintUpdates[0]) 
          ? constraintUpdates.flat() 
          : constraintUpdates;
        
        // Apply each constraint as an update rule
        flatConstraints.forEach(constraint => {
          if (constraint && constraint.events && constraint.update) {
            // Extract signal names from update expression
            const signalNames = extractSignalNames(constraint.update);
            
            // Create event triggers for each signal
            const events = signalNames.map(name => ({ signal: name }));
            
            // Add update rule
            updates.push({
              events,
              update: constraint.update
            });
          }
        });
        
        return updates;
      }
    }
    
    return new MergedComponent();
  }