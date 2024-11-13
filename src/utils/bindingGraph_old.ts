import { AnchorSchema , AnchorOrGroupSchema} from '../types/anchors';

export interface ComponentRef {
  componentId: string;
  anchorId: string;
}

export interface Binding {
  id: string;
  source: ComponentRef;
  target: ComponentRef;
  // The types of anchors being connected
  sourceType: 'geometric' | 'encoding' | 'event' | 'group';
  targetType: 'geometric' | 'encoding' | 'event' | 'group';
}

// src/utils/binding-graph.ts
export class BindingGraph {
  private bindings: Map<string, Binding> = new Map();
  private componentAnchors: Map<string, Map<string, AnchorOrGroupSchema>> = new Map();
  
  constructor() {}

  addComponent(componentId: string, anchors: Map<string, AnchorOrGroupSchema>) {
    this.componentAnchors.set(componentId, anchors);
  }

  addBinding(
    sourceComponentId: string,
    sourceAnchorId: string,
    targetComponentId: string,
    targetAnchorId: string
  ): string[] {
    const sourceAnchors = this.componentAnchors.get(sourceComponentId);
    const targetAnchors = this.componentAnchors.get(targetComponentId);

    if (!sourceAnchors || !targetAnchors) {
      throw new Error('Component not found');
    }

    const sourceAnchor = sourceAnchors.get(sourceAnchorId);
    const targetAnchor = targetAnchors.get(targetAnchorId);

    if (!sourceAnchor || !targetAnchor) {
      throw new Error('Anchor not found');
    }

    // Handle groups
    if (sourceAnchor.type === 'group' && targetAnchor.type === 'group') {
      // Both are groups - bind all children to each other
      const bindingIds: string[] = [];
      sourceAnchor.children.forEach((sourceChild, sourceChildId) => {
        targetAnchor.children.forEach((targetChild, targetChildId) => {
          bindingIds.push(this.createSingleBinding(
            sourceComponentId, sourceChildId,
            targetComponentId, targetChildId,
            sourceChild, targetChild
          ));
        });
      });
      return bindingIds;
    } else if (sourceAnchor.type === 'group') {
        
      // Source is group - bind all children to target
      if (targetAnchor.type === 'group') {
        throw new Error('TODO: Target groups are not implemented yet');
      }
      // for example, chart.top.bind(chart2.x) should probably error?
      // alx.rect.bind(rect2.sides)
      return Array.from(sourceAnchor.children.keys()).map(childId => 
        this.createSingleBinding(
          sourceComponentId, childId,
          targetComponentId, targetAnchorId,
          sourceAnchor.children.get(childId)!, targetAnchor
        )
        
      );
    } else if (targetAnchor.type === 'group') {
      // Target is group - bind source to all children
      return Array.from(targetAnchor.children.keys()).map(childId =>
        this.createSingleBinding(
          sourceComponentId, sourceAnchorId,
          targetComponentId, childId,
          sourceAnchor, targetAnchor.children.get(childId)!
        )
      );
    }

    // Neither is a group - create single binding
    return [this.createSingleBinding(
      sourceComponentId, sourceAnchorId,
      targetComponentId, targetAnchorId,
      sourceAnchor, targetAnchor
    )];
  }

  private createSingleBinding(
    sourceComponentId: string,
    sourceAnchorId: string,
    targetComponentId: string,
    targetAnchorId: string,
    sourceAnchor: AnchorSchema,
    targetAnchor: AnchorSchema
  ): string {
    const bindingId = `binding_${Date.now()}_${Math.random()}`;
    
    const binding: Binding = {
      id: bindingId,
      source: {
        componentId: sourceComponentId,
        anchorId: sourceAnchorId
      },
      target: {
        componentId: targetComponentId,
        anchorId: targetAnchorId
      },
      sourceType: sourceAnchor.type,
      targetType: targetAnchor.type
    };

    this.bindings.set(bindingId, binding);
    return bindingId;
  }

  getBindings(componentId?: string): Binding[] {
    if (componentId) {
      return Array.from(this.bindings.values()).filter(binding => 
        binding.source.componentId === componentId ||
        binding.target.componentId === componentId
      );
    }
    return Array.from(this.bindings.values());
  }

  getComponentAnchors(componentId: string): Map<string, AnchorOrGroupSchema> | undefined {
    return this.componentAnchors.get(componentId);
  }

  getBinding(bindingId: string): Binding | undefined {
    return this.bindings.get(bindingId);
  }

  // Get all bindings where this component/anchor is the source
  getSourceBindings(componentId: string, anchorId?: string): Binding[] {
    return Array.from(this.bindings.values()).filter(binding => 
      binding.source.componentId === componentId &&
      (!anchorId || binding.source.anchorId === anchorId)
    );
  }

  // Get all bindings where this component/anchor is the target
  getTargetBindings(componentId: string, anchorId?: string): Binding[] {
    return Array.from(this.bindings.values()).filter(binding => 
      binding.target.componentId === componentId &&
      (!anchorId || binding.target.anchorId === anchorId)
    );
  }
}
