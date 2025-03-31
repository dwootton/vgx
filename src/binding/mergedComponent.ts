import { BaseComponent } from "../components/base";
import { BindingManager } from "./BindingManager";
import { UnitSpec } from "vega-lite/build/src/spec";
import { Field } from "vega-lite/build/src/channeldef";
import { AnchorProxy, SchemaType } from "../types/anchors";
import { Constraint, ConstraintType, constraintToUpdateRule } from './constraints';
import { extractAnchorType, isAnchorTypeCompatible } from "./cycles";

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

import { mergeConstraints } from "../components/utils";
/**
 * Extract constraints for a merged component from all parent components
 */
export function extractConstraintsForMergedComponent(
    parentAnchors: { anchor: AnchorProxy, targetId: string }[],
    constraintsByNode: Record<string, Record<string, Constraint[]>>,
    component: BaseComponent
): Record<string, Constraint[]> {
    const mergedConstraints: Record<string, Constraint[]> = {};
    
    parentAnchors.forEach(anchorFromParent => {
        const parentId = anchorFromParent.anchor.id.componentId;

        const parentSignalName = `${parentId}_${anchorFromParent.targetId}_internal`;

        if(!mergedConstraints[parentSignalName] ){
            mergedConstraints[parentSignalName] = [];
        }
        
        const otherParentIds = parentAnchors
            .map(anchor => anchor.anchor.id.componentId)
            .filter(id => id !== parentId);

        
        otherParentIds.forEach(otherParentId => {
            const otherConstraints = constraintsByNode[otherParentId];
            if (!otherConstraints) return;
            
            const channel = component.getAnchors()[0]?.id.anchorId;
            if (!channel) return;
            const constrainKeys = Object.keys(otherConstraints).filter(key => key.includes(channel)&&key.includes('internal'));
            let internalConstraints = otherConstraints[constrainKeys[0]] || [];

            // Deduplicate constraints to avoid applying the same constraint multiple times
            const uniqueConstraints = internalConstraints.reduce((unique, constraint) => {
                // Check if this constraint is already in our unique list
                const isDuplicate = unique.some(existingConstraint => 
                    JSON.stringify(existingConstraint) === JSON.stringify(constraint)
                );
                
                if (!isDuplicate) {
                    unique.push(constraint);
                }
                
                return unique;
            }, [] as Constraint[]);
            
            // Use the deduplicated constraints
            internalConstraints = uniqueConstraints;

           
            internalConstraints.forEach(constraint => {
                const transformedConstraint: Constraint = {
                    ...constraint,
                    triggerReference: parentSignalName
                };
                mergedConstraints[parentSignalName] = [...mergedConstraints[parentSignalName], transformedConstraint];
            });
        });
    });
    return mergedConstraints;
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
        const extractedChannel = extractAnchorType(key);
        return extractedChannel === channel;
      });
    });
    
    if (!schemaComponent) {
      throw new Error(`No component has schema for channel ${channel}`);
    }
    
    // Create the merged component ID
    const mergedId = `merged_${nodeIds.join('_')}_${channel}`;
    
    console.log('schemaComponent', schemaComponent)
    // Use schema from the component we found
    const mergedSchemaKeys = Object.keys(schemaComponent.schema)
    const mergedSchemaKey = mergedSchemaKeys.find(key => key.includes(channel))
    const mergedSchema = schemaComponent.schema[mergedSchemaKey];



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
        console.log('mergedSchema', mergedSchema)
        
        // Create an anchor that provides an absolute value
        this.anchors.set(channel, this.createAnchorProxy(
          { [channel]: {container:'Absolute', valueType:mergedSchema.valueType} },
          channel,
          () => ({ value: `${this.id}` })
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
        const mergedSignal = context['VGX_MERGED_SIGNAL_NAME'] || [];
        
        // // Create the merged signal with update rules
        // const mergedSignal = {
        //   name: `${this.id}`,
        //   value: 0,
        //   on: this.buildUpdateRules(mergedSignalConstraints)
        // };
        
        return {
          params: [mergedSignal]
        };
      }
    }
      
      
    
    return new MergedComponent();
  }