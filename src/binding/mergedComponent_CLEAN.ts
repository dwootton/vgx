import { BaseComponent } from "../components/base";
import { BindingManager } from "./BindingManager";
import { UnitSpec } from "vega-lite/build/src/spec";
import { Field } from "vega-lite/build/src/channeldef";
import { AnchorProxy, SchemaType } from "../types/anchors";
import { Constraint, ConstraintType, constraintToUpdateRule } from './constraints';

// Identifier for merged component signals in constraints
export const MERGED_SIGNAL_NAME = 'MERGED_SIGNAL_CONSTRAINTS';

/**
 * Creates a merged component to handle bidirectional constraints between two components.
 * The merged component acts as a mediator that enforces all constraints in both directions.
 * 
 * @param node1Id First component ID in the cycle
 * @param node2Id Second component ID in the cycle
 * @param channel The channel/anchor ID that is part of the cycle
 * @param bindingManager The binding manager instance
 * @returns A new merged component
 */
export function createMergedComponent(
  node1Id: string,
  node2Id: string,
  channel: string,
  bindingManager: BindingManager
): BaseComponent {
  const component1 = bindingManager.getComponent(node1Id);
  const component2 = bindingManager.getComponent(node2Id);
  
  if (!component1 || !component2) {
    throw new Error(`Components not found: ${node1Id}, ${node2Id}`);
  }
  
  // Create the merged component
  const mergedId = `merged_${node1Id}_${node2Id}_${channel}`;
  const mergedSchema = component1.schema[channel]; 
  
  class MergedComponent extends BaseComponent {
    mergedComponent: boolean;
    node1Id: string;
    node2Id: string;
    channel: string;
    
    constructor() {
      super({});
      this.id = mergedId;
      this.mergedComponent = true;
      this.node1Id = node1Id;
      this.node2Id = node2Id;
      this.channel = channel;
      
      // Set schema to match the involved components
      this.schema = { [channel]: mergedSchema };
      
      // Create an anchor that provides an absolute value
      this.anchors.set(channel, this.createAnchorProxy(
        { [channel]: this.schema[channel] },
        channel,
        () => ({ absoluteValue: `${this.id}` })
      ));
    }
    
    /**
     * Compiles the merged component into a Vega-Lite spec.
     * The merged component creates a single signal that coordinates
     * between the two original components, applying all constraints.
     */
    compileComponent(context: any): Partial<UnitSpec<Field>> {
      // Extract merged signal constraints, if any
      const mergedSignalConstraints = context[MERGED_SIGNAL_NAME] || [];

      console.log('mergedSignalConstraints', JSON.parse(JSON.stringify(mergedSignalConstraints)))
      
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

/**
 * Extracts node signal names from an update expression.
 */
function extractSignalNames(updateExpr: string): string[] {
  // This is a simplified implementation - in practice, you would
  // use a more sophisticated parser to extract signal references
  const signalRegex = /\b(\w+)_(\w+)(?:_internal)?\b/g;
  const matches = updateExpr.match(signalRegex) || [];
  return [...new Set(matches)]; // Deduplicate
}

/**
 * Extracts and processes constraints for merged components.
 * This function gathers constraints from all components in the cycle
 * and transforms them so they can be applied bidirectionally.
 */
export function extractConstraintsForMergedComponent(
  parentAnchors: { anchor: AnchorProxy, targetId: string }[],
  constraintsByNode: Record<string, Record<string, Constraint[]>>,
  component: BaseComponent
): Constraint[] {
  // Extract parent component IDs
  const parentComponentIds = parentAnchors.map(
    anchor => anchor.anchor.id.componentId
  );
  
  const mergedConstraints: Constraint[] = [];
  
  // For each parent component
  parentComponentIds.forEach(parentId => {
    // Get the anchor from this parent that feeds the merged component
    const anchorFromParent = parentAnchors.find(
      anchor => anchor.anchor.id.componentId === parentId
    );
    
    if (!anchorFromParent) return;
    
    // Get parent internal signal name
    const internalSignal = `${parentId}_${anchorFromParent.targetId}_internal`;
    
    // Get other parents
    const otherParentIds = parentComponentIds.filter(id => id !== parentId);
    
    // Apply constraints from other parents using this parent's signal
    otherParentIds.forEach(otherParentId => {
      const otherConstraints = constraintsByNode[otherParentId];
      if (!otherConstraints) return;
      
      const channel = component.getAnchors()[0]?.id.anchorId;
      if (!channel) return;
      
      // Get constraints for the internal signal
      const internalConstraints = otherConstraints[`${channel}_internal`] || [];
      
      // Transform constraints to use parent's signal
      internalConstraints.forEach(constraint => {
        // Clone the constraint but change the source signal
        const transformedConstraint: Constraint = {
          ...constraint,
          sourceSignal: internalSignal
        };
        
        mergedConstraints.push(transformedConstraint);
      });
    });
  });
  
  return mergedConstraints;
} 