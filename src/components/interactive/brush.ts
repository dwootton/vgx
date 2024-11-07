import { BaseComponent } from "../base";
import { RectAnchorConfig, RectAnchors } from "../../anchors/rect";
import { CompilationContext, CompilationResult, ParentInfo } from "../../types/compilation";
import { Line, Area, Point } from "types/geometry";
import { GeometricAnchor } from "types/anchors";

type BrushConfig = RectAnchorConfig;
// Types for information passed down from parent during compilation

export class Brush extends BaseComponent {
  private rectAnchors: RectAnchors;
  private config: BrushConfig;
  constructor(config: BrushConfig) {
    super();
    this.config = config;
    this.rectAnchors = new RectAnchors(this);
    this.initializeAnchors();
  }

  private initializeAnchors() {

    // Initialize base rect anchors
    const anchors = this.rectAnchors.initializeRectAnchors({
      x1: this.config.x1 || 0,
      y1: this.config.y1 || 0,
      x2: this.config.x2 || 100,
      y2: this.config.y2 || 100
    });

    // Add to component anchors
    anchors.forEach((anchor, id) => {
      this.anchors.set(id, this.createAnchorProxy(anchor));
    });
  }

  compileComponent(context: CompilationContext, parentInfo?: ParentInfo): CompilationResult {
    // if compile called on brush, bubble it up to root component



    if (!parentInfo?.boundAnchor) {
      return {}; // No parent info or bound anchor
    }

    // Base selection parameter
    const selectionSpec: any = {
      name: `${this.id}_selection`,
      select: { type: "interval" }
    };

    const { boundAnchor } = parentInfo;

    // Determine selection behavior based on bound anchor
    switch (boundAnchor.anchorRef.type) {
      case 'encoding':
        // If bound to an encoding anchor (like chart.x or chart.xy)
        if (boundAnchor.id === 'x') {
          selectionSpec.select.encodings = ['x'];
        } else if (boundAnchor.id === 'y') {
          selectionSpec.select.encodings = ['y'];
        } else if (boundAnchor.id === 'xy') {
          selectionSpec.select.encodings = ['x', 'y'];
        }
        break;

      case 'geometric':
        // Handle geometric anchors (like points, lines, areas)
        const geometry = boundAnchor.anchorRef.geometry;
          switch (geometry.type) {
            case 'line':
              // Determine if line is horizontal or vertical
              const { y1, y2, x1, x2 } = geometry;
              if (y1 === y2) {
                selectionSpec.select.encodings = ['x'];
              } else if (x1 === x2) {
                selectionSpec.select.encodings = ['y'];
              }
              break;
            case 'area':
              selectionSpec.select.encodings = ['x', 'y'];
              break;
            case 'point':
              // Point doesn't make sense for interval selection
              return {};
          }
        
        break;
    }

    return {
      params: [selectionSpec]
    };
  }

}
// next steps:
// add compilation steps from the binding graph into a vegalite/vega sepc
// add more instruments and events
// figure out how to hadnle data mismatch between different components
// build in data validation during binding's instantitation. 