import { SchemaType, RangeValue, SetValue, ScalarValue, ValueType } from "../types/anchors";

/**
 * Defines the type of constraint to apply to a signal
 */
export enum ConstraintType {
  CLAMP = 'clamp',      // Restrict to a range
  NEAREST = 'nearest',  // Find nearest value in a set
  ABSOLUTE = 'absolute', // Exact value constraint
  EXPRESSION = 'expression', // Custom expression
  SCALAR = 'scalar', // Scalar value constraint
  DATA = 'data', // Data value constraint TODO: remove and change this to a valueType
  IDENTITY = 'identity' // Identity constraint
}

/**
 * Represents a single constraint on a component property
 */
export interface Constraint {
  // The type of constraint being applied
  type: ConstraintType;
  
  // Source signal name that triggers this constraint
  triggerReference?: string;
  isImplicit?: boolean;

  constraintValueType?: ValueType;
  
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

  if(constraint.isImplicit){
    console.log('compileConstraint Implicit', constraint, targetSignal, compileConstraint({...constraint, isImplicit: false}, `base_${targetSignal || constraint.triggerReference}`))
    return compileConstraint({...constraint, isImplicit: false}, `base_${targetSignal || constraint.triggerReference}`)
    // return `${targetSignal || constraint.triggerReference}`;
  }
    // // current hack for categorical values
    // if(constraint.constraintValueType === "Categorical"){
    //     return `${targetSignal || constraint.triggerReference}`;
    // }
    if(constraint.constraintValueType === "Categorical"){
        console.log('compileConstraint Categorical', constraint, targetSignal)
        return `${ constraint.triggerReference}`;
    } else if(constraint.constraintValueType === "Data"){
        return `${targetSignal || constraint.triggerReference}`;
    }

    // else numeric
     
  switch (constraint.type) {
    case ConstraintType.ABSOLUTE:
      return constraint.value || "0";
    case ConstraintType.SCALAR:
        return `clamp(${targetSignal || constraint.triggerReference}, ${constraint.value}, ${constraint.value})`;
  
    case ConstraintType.CLAMP:
      return `clamp(${targetSignal || constraint.triggerReference}, ${constraint.min}, ${constraint.max})`;
      
    case ConstraintType.NEAREST:
      return `nearest(${targetSignal || constraint.triggerReference}, [${constraint.values?.join(', ')}])`;
    case ConstraintType.EXPRESSION:
      // Replace placeholder with actual signal if needed
      return constraint.expression?.replace('TARGET_SIGNAL', targetSignal || constraint.triggerReference || '') || "0";
      
    case ConstraintType.IDENTITY:
      return targetSignal || constraint.triggerReference || "0";
      
    default:
      return targetSignal || constraint.triggerReference || "0";
  }
}

/**
 * Creates a constraint from a schema and value
 */
export function createConstraintFromSchema(
  schema: SchemaType,
  value: any,
  triggerReference?: string,
  isImplicit?: boolean
): Constraint {

    if(schema.valueType === "Categorical"){
        return {
            type: ConstraintType.ABSOLUTE,
            // value: value.value,
            triggerReference,
            isImplicit,
            constraintValueType: schema.valueType
        }
    }
    
    if (schema.valueType === ConstraintType.ABSOLUTE) {
        return {
            type: ConstraintType.ABSOLUTE,
            value: value.value,
        };
    }
    if (schema.valueType === 'Data') {
        return {
          type: ConstraintType.DATA,
          triggerReference,
          value: "VGX_MOD_"+value.value
        };
      }


  if (schema.container === 'Range') {
    // Handle range value constraint (min/max)
    const rangeValue = value as RangeValue;
    return {
      type: ConstraintType.CLAMP,
      triggerReference,
      min: String(rangeValue.start),
      max: String(rangeValue.stop),
      isImplicit
    };
  }
  
  if (schema.container === 'Set') {
    // Handle set value constraint (discrete values)
    const setValue = value as SetValue;
    return {
      type: ConstraintType.NEAREST,
      triggerReference,
      values: setValue.values.map(v => String(v)),
      isImplicit
    };
  }
  
  if (schema.container === 'Scalar') {
    // Handle scalar value constraint
    if (typeof value === 'object' && 'value' in value) {
      const scalarValue = value as ScalarValue;
      return {
        type: ConstraintType.SCALAR,
        triggerReference,
        value: String(scalarValue.value),
        isImplicit
      };
    } else if (typeof value === 'string') {
      // Handle direct string value (like from a compiled anchor)
      return {
        type: ConstraintType.EXPRESSION,
        triggerReference,
        expression: value,
        isImplicit
      };
    } else if (typeof value === 'object' && 'expression' in value) {
      // Handle expression object
      return {
        type: ConstraintType.EXPRESSION,
        triggerReference,
        expression: value.expression,
        isImplicit
      };
    }
  }

  

  
  // Default fallback for unknown types
  return {
    type: ConstraintType.EXPRESSION,
    triggerReference,
    expression: String(value),
    isImplicit
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
  triggerReference?: string
): Constraint {
  return {
    type: ConstraintType.EXPRESSION,
    triggerReference,
    expression
  };
} 