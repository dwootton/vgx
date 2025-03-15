import { SchemaType, SchemaValue, RangeValue, SetValue, ScalarValue } from "../types/anchors";

/**
 * Defines the type of constraint to apply to a signal
 */
export enum ConstraintType {
  CLAMP = 'clamp',      // Restrict to a range
  NEAREST = 'nearest',  // Find nearest value in a set
  ABSOLUTE = 'absolute', // Exact value constraint
  EXPRESSION = 'expression' // Custom expression
}

/**
 * Represents a single constraint on a component property
 */
export interface Constraint {
  // The type of constraint being applied
  type: ConstraintType;
  
  // Source signal name that triggers this constraint
  sourceSignal?: string;
  
  // For each constraint type, we need different parameters:
  min?: string;         // For CLAMP - can be signal name or expression
  max?: string;         // For CLAMP - can be signal name or expression
  values?: string[];    // For NEAREST - array of signal names or expressions
  value?: string;       // For ABSOLUTE - direct value or signal name
  expression?: string;  // For EXPRESSION - custom Vega expression
}

/**
 * Converts a constraint to a Vega-Lite update expression
 */
export function compileConstraint(constraint: Constraint, targetSignal?: string): string {
  switch (constraint.type) {
    case ConstraintType.CLAMP:
      return `clamp(${targetSignal || constraint.sourceSignal}, ${constraint.min}, ${constraint.max})`;
      
    case ConstraintType.NEAREST:
      return `nearest(${targetSignal || constraint.sourceSignal}, [${constraint.values?.join(', ')}])`;
      
    case ConstraintType.ABSOLUTE:
      return constraint.value || "0";
      
    case ConstraintType.EXPRESSION:
      // Replace placeholder with actual signal if needed
      return constraint.expression?.replace('TARGET_SIGNAL', targetSignal || constraint.sourceSignal || '') || "0";
      
    default:
      return targetSignal || constraint.sourceSignal || "0";
  }
}

/**
 * Converts a constraint to a Vega-Lite update rule
 */
export function constraintToUpdateRule(constraint: Constraint, targetSignal?: string): any {
  // If we have a source signal, this becomes an event-based update
  if (constraint.sourceSignal) {
    return {
      events: { signal: constraint.sourceSignal },
      update: compileConstraint(constraint, targetSignal)
    };
  }
  
  // Otherwise, it's a simple initialization
  return {
    update: compileConstraint(constraint, targetSignal)
  };
}

/**
 * Creates a constraint from a schema and value
 */
export function createConstraintFromSchema(
  schema: SchemaType,
  value: any,
  sourceSignal?: string
): Constraint {
  if (schema.container === 'Range') {
    // Handle range value constraint (min/max)
    const rangeValue = value as RangeValue;
    return {
      type: ConstraintType.CLAMP,
      sourceSignal,
      min: String(rangeValue.start),
      max: String(rangeValue.stop)
    };
  }
  
  if (schema.container === 'Set') {
    // Handle set value constraint (discrete values)
    const setValue = value as SetValue;
    return {
      type: ConstraintType.NEAREST,
      sourceSignal,
      values: setValue.values.map(v => String(v))
    };
  }
  
  if (schema.container === 'Scalar') {
    // Handle scalar value constraint
    if (typeof value === 'object' && 'value' in value) {
      const scalarValue = value as ScalarValue;
      return {
        type: ConstraintType.ABSOLUTE,
        sourceSignal,
        value: String(scalarValue.value)
      };
    } else if (typeof value === 'string') {
      // Handle direct string value (like from a compiled anchor)
      return {
        type: ConstraintType.EXPRESSION,
        sourceSignal,
        expression: value
      };
    } else if (typeof value === 'object' && 'expression' in value) {
      // Handle expression object
      return {
        type: ConstraintType.EXPRESSION,
        sourceSignal,
        expression: value.expression
      };
    }
  }
  
  // Default fallback for unknown types
  return {
    type: ConstraintType.EXPRESSION,
    sourceSignal,
    expression: String(value)
  };
}

/**
 * Creates an absolute value constraint
 */
export function createAbsoluteConstraint(value: string | number): Constraint {
  return {
    type: ConstraintType.ABSOLUTE,
    value: String(value)
  };
}

/**
 * Creates a signal reference constraint
 * This is useful when you want one signal to directly mirror another
 */
export function createSignalReferenceConstraint(signalName: string): Constraint {
  return {
    type: ConstraintType.EXPRESSION,
    expression: signalName
  };
}

/**
 * Creates a custom expression constraint
 */
export function createExpressionConstraint(
  expression: string,
  sourceSignal?: string
): Constraint {
  return {
    type: ConstraintType.EXPRESSION,
    sourceSignal,
    expression
  };
} 