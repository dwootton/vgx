/**
 * Kiwi.js Expression Converter
 * 
 * This module provides functionality to convert from our symbolic PortExpression system
 * to @lume/kiwi constraints and expressions.
 */

import {
    PortExpression,
    StateRef,
    PortValue,
    PortRelationship,
    PortExpressionValue,
    isStateRef
  } from './portExpressions';
  
  // Import @lume/kiwi types
  import * as kiwi from '@lume/kiwi';
  
  /**
   * Manages Kiwi variables and constraints
   */
  export class KiwiManager {
    private variables: Map<string, kiwi.Variable> = new Map();
    private solver: kiwi.Solver;
    private stateRefs: Map<string, StateRef> = new Map();
    private valueOverrides: Map<string, number> = new Map();
    
    constructor() {
      this.solver = new kiwi.Solver();
    }
    
    /**
     * Register a state reference with the manager
     * This allows for retrieving references by their compiled names
     */
    registerStateRef(ref: StateRef): void {
      // Only register if it has compilation info
      if (ref.componentId) {
        const path = ref.getFullPath();
        this.stateRefs.set(path, ref);
      }
    }
    
    /**
     * Register multiple state references
     */
    registerStateRefs(refs: Record<string, StateRef>): void {
      for (const key in refs) {
        this.registerStateRef(refs[key]);
      }
    }
    
    /**
     * Get or create a Kiwi variable for a reference
     */
    getVariable(ref: StateRef | string): kiwi.Variable {
      // If given a string, look up the reference first if possible
      let key: string;
      
      if (typeof ref === 'string') {
        key = ref;
        // Check if this matches a known state ref ID
        for (const [path, stateRef] of this.stateRefs.entries()) {
          if (stateRef.id === ref) {
            key = path;
            break;
          }
        }
      } else {
        key = ref.getFullPath();
      }
      
      if (!this.variables.has(key)) {
        // Create a new kiwi.Variable
        const variable = new kiwi.Variable(key);
        
        // Set initial value if we have an override
        if (this.valueOverrides.has(key)) {
          variable.setValue(this.valueOverrides.get(key)!);
        }
        
        this.variables.set(key, variable);
      }
      
      return this.variables.get(key)!;
    }
    
    /**
     * Set a value override for a variable
     * This provides an initial value for a Kiwi variable
     */
    setVariableValue(ref: StateRef | string, value: number): void {
      const key = typeof ref === 'string' ? ref : ref.getFullPath();
      
      // Store the override value
      this.valueOverrides.set(key, value);
      
      // Update the variable if it already exists
      if (this.variables.has(key)) {
        this.variables.get(key)!.setValue(value);
      }
    }
    
    /**
     * Add a constraint from a PortRelationship
     */
    addConstraintFromRelationship(
      targetRef: StateRef | string,
      relationship: PortRelationship,
      portValue: PortValue,
      strength: number = kiwi.Strength.required
    ): kiwi.Constraint {
      // Get the Kiwi variable for the target
      const targetVar = this.getVariable(targetRef);
      
      // Create a port expression from the relationship's update function
      const expr = relationship.update(portValue);
      
      // Convert to a Kiwi expression
      const kiwiExpr = this.expressionToKiwi(expr);
      
      // Create the constraint (targetVar = kiwiExpr)
      const constraint = new kiwi.Constraint(
        new kiwi.Expression(targetVar).minus(kiwiExpr),
        kiwi.Operator.Eq,
        strength
      );
      
      // Add the constraint to the solver
      this.solver.addConstraint(constraint);
      
      return constraint;
    }
    
    /**
     * Convert a PortExpression to a Kiwi expression
     */
    expressionToKiwi(expr: PortExpression | PortExpressionValue): kiwi.Expression {
      // Handle different types of expressions
      if (expr instanceof PortExpression) {
        const exprStr = expr.toString();
        
        // Check if it's a simple number
        const numValue = Number(exprStr);
        if (!isNaN(numValue)) {
          return new kiwi.Expression(numValue);
        }
        
        // If it has an operator, handle as a compound expression
        const operator = expr.getOperator();
        if (operator) {
          const left = expr.getLeft();
          const right = expr.getRight();
          
          if (left !== undefined && right !== undefined) {
            // Convert left side to Kiwi expression
            const leftExpr = this.expressionToKiwi(left);
            
            // Handle different operators
            switch (operator) {
              case '+':
                return leftExpr.plus(this.expressionToKiwi(right));
                
              case '-':
                return leftExpr.minus(this.expressionToKiwi(right));
                
              case '*':
                // Kiwi only supports multiplication by constants
                if (typeof right === 'number') {
                  return leftExpr.multiply(right);
                } else {
                  const rightStr = right instanceof PortExpression 
                    ? right.toString() 
                    : String(right);
                  const rightNum = Number(rightStr);
                  if (!isNaN(rightNum)) {
                    return leftExpr.multiply(rightNum);
                  }
                  throw new Error(`Kiwi only supports multiplication by constants: ${expr.toString()}`);
                }
                
              case '/':
                // Kiwi only supports division by constants
                if (typeof right === 'number') {
                  if (right === 0) throw new Error("Division by zero");
                  return leftExpr.divide(right);
                } else {
                  const rightStr = right instanceof PortExpression 
                    ? right.toString() 
                    : String(right);
                  const rightNum = Number(rightStr);
                  if (!isNaN(rightNum)) {
                    if (rightNum === 0) throw new Error("Division by zero");
                    return leftExpr.divide(rightNum);
                  }
                  throw new Error(`Kiwi only supports division by constants: ${expr.toString()}`);
                }
                
              default:
                throw new Error(`Unsupported operator: ${operator}`);
            }
          }
        }
        
        // Check for port notation
        if (exprStr.startsWith('port(') && exprStr.endsWith(')')) {
          // This is a port reference - for now, create a variable with this name
          const portId = exprStr.substring(5, exprStr.length - 1);
          return new kiwi.Expression(this.getVariable(portId));
        }
        
        // Otherwise, treat as a variable reference
        // Check if this is a state reference we know about
        for (const [path, ref] of this.stateRefs.entries()) {
          if (exprStr === ref.id || exprStr === path) {
            return new kiwi.Expression(this.getVariable(path));
          }
        }
        
        // Fall back to treating as a variable name
        return new kiwi.Expression(this.getVariable(exprStr));
      } else if (isStateRef(expr)) {
        // For StateRef objects
        return new kiwi.Expression(this.getVariable(expr));
      } else if (expr instanceof PortValue) {
        // For PortValue objects
        return this.expressionToKiwi(expr.toExpression());
      } else if (typeof expr === 'number') {
        // For numeric constants
        return new kiwi.Expression(expr);
      } else if (typeof expr === 'string') {
        // For string references
        return new kiwi.Expression(this.getVariable(expr));
      }
      
      // Last resort - convert to string and use as variable
      return new kiwi.Expression(this.getVariable(String(expr)));
    }
    
    /**
     * Solve the constraint system
     */
    solve(): Map<string, number> {
      // Solve the system
      this.solver.updateVariables();
      
      // Return the solved values
      const result = new Map<string, number>();
      for (const [key, variable] of this.variables.entries()) {
        result.set(key, variable.value());
      }
      
      return result;
    }
    
    /**
     * Add a custom constraint to the solver
     */
    addConstraint(
      left: PortExpressionValue, 
      operator: 'eq' | 'leq' | 'geq',
      right: PortExpressionValue,
      strength: number = kiwi.Strength.required
    ): kiwi.Constraint {
      const leftExpr = this.expressionToKiwi(left);
      const rightExpr = this.expressionToKiwi(right);
      
      let kiwiOperator: kiwi.Operator;
      switch (operator) {
        case 'eq': kiwiOperator = kiwi.Operator.Eq; break;
        case 'leq': kiwiOperator = kiwi.Operator.Le; break;
        case 'geq': kiwiOperator = kiwi.Operator.Ge; break;
        default: throw new Error(`Unsupported operator: ${operator}`);
      }
      
      const constraint = new kiwi.Constraint(
        leftExpr.minus(rightExpr),
        kiwiOperator,
        strength
      );
      
      this.solver.addConstraint(constraint);
      return constraint;
    }
    
    /**
     * Remove a constraint from the solver
     */
    removeConstraint(constraint: kiwi.Constraint): void {
      this.solver.removeConstraint(constraint);
    }
    
    /**
     * Clear all constraints from the solver
     */
    clearConstraints(): void {
      this.solver = new kiwi.Solver();
      
      // Recreate variables in the new solver
      const newVariables = new Map<string, kiwi.Variable>();
      for (const [path, oldVar] of this.variables.entries()) {
        const newVar = new kiwi.Variable(path);
        // Preserve overridden values
        if (this.valueOverrides.has(path)) {
          newVar.setValue(this.valueOverrides.get(path)!);
        } else {
          newVar.setValue(oldVar.value());
        }
        newVariables.set(path, newVar);
      }
      this.variables = newVariables;
    }
    
    /**
     * Get variable value after solving
     */
    getVariableValue(ref: StateRef | string): number {
      const key = typeof ref === 'string' ? ref : ref.getFullPath();
      if (this.variables.has(key)) {
        return this.variables.get(key)!.value();
      }
      throw new Error(`Variable not found: ${key}`);
    }
  }
  
  /**
   * Create a relationship that establishes a Kiwi constraint
   */
  export function createKiwiRelationship(
    ref: StateRef,
    updateFn: (portValue: PortValue) => PortExpression | PortExpressionValue
  ): PortRelationship {
    return {
      ref,
      update: updateFn
    };
  }
  
  /**
   * Create constraint helpers for common relationships
   */
  export function createEqualConstraint(
    kiwiManager: KiwiManager,
    left: PortExpressionValue,
    right: PortExpressionValue,
    strength: number = kiwi.Strength.required
  ): kiwi.Constraint {
    return kiwiManager.addConstraint(left, 'eq', right, strength);
  }
  
  export function createLessThanOrEqualConstraint(
    kiwiManager: KiwiManager,
    left: PortExpressionValue,
    right: PortExpressionValue,
    strength: number = kiwi.Strength.required
  ): kiwi.Constraint {
    return kiwiManager.addConstraint(left, 'leq', right, strength);
  }
  
  export function createGreaterThanOrEqualConstraint(
    kiwiManager: KiwiManager,
    left: PortExpressionValue,
    right: PortExpressionValue,
    strength: number = kiwi.Strength.required
  ): kiwi.Constraint {
    return kiwiManager.addConstraint(left, 'geq', right, strength);
  }