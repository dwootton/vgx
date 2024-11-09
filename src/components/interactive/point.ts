import { BaseComponent } from "../base";
import { CompilationContext, CompilationResult, ParentInfo } from "../../types/compilation";
import { Placeholder } from "../../types/compilation";
import { GeometricAnchor } from "../../types/anchors";
import { Point } from "../../types/geometry";

interface PointConfig {
  initialX?: number | string; // Can be a static number or a dynamic expression
  initialY?: number | string;
}

export class PointComponent extends BaseComponent {
  private config: PointConfig;

  constructor(config: PointConfig) {
    super();
    this.config = config;
    this.requiredProperties = ['x', 'y'];
    this.initializeAnchors();
  }

  private initializeAnchors() {
    const centerAnchor: GeometricAnchor<Point> = {
      id: "center",
      type: "geometric",
      geometry: {
        type: "point",
        x: this.config.initialX ?? 0,
        y: this.config.initialY ?? 0
      }
    };
    this.anchors.set(centerAnchor.id, this.createAnchorProxy(centerAnchor));
  }

  compileComponent(context: CompilationContext, parentInfo?: ParentInfo): CompilationResult {
    const placeholders: Placeholder[] = [];

    // Retrieve initial positions from parent info if available
    const anchorRef = parentInfo?.boundAnchor?.anchorRef;
    const parentInitialX = anchorRef?.type === 'geometric' ? (anchorRef as GeometricAnchor<Point>).geometry?.x : `placeholder_${this.id}_x`;
    const parentInitialY = anchorRef?.type === 'geometric' ? (anchorRef as GeometricAnchor<Point>).geometry?.y : `placeholder_${this.id}_y`;

    const xExpr = `clamp(${this.config.initialX ?? parentInitialX}, scale('x').range[0], scale('x').range[1])`;
    // y is inverted because svg's y-axis is inverted
    const yExpr = `clamp(${this.config.initialY ?? parentInitialY}, scale('y').range[1], scale('y').range[0])`;

    if (xExpr.includes("placeholder")) {
      placeholders.push({ property: 'x', componentId: this.id });
    }
    if (yExpr.includes("placeholder")) {
      placeholders.push({ property: 'y', componentId: this.id });
    }

    return {
      spec: {
        mark: {
          "type": "point",
          x: { expr: xExpr },
          y: { expr: yExpr },
          color: "firebrick",
          size: 100,
          opacity: 1
        }
      },
      placeholders
    };
  }
}