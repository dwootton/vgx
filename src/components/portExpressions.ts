/**
 * Symbolic Port Expression System
 * 
 * This file contains the core types and functionality for creating symbolic
 * expression-based relationships that can be compiled to constraint systems.
 */

// ====== Core Type Definitions ======

/**
 * Represents a symbolic reference to a state property
 */
export type StateRef = {
    id: string;         // Unique identifier for the state
    path: string[];     // Path to the property in the state
    componentId?: string; // Optional component identifier
    
    // Method to get the full reference path
    getFullPath(): string;
  };
  
  /**
   * Enhanced StateRef that supports expression operations
   */
  export class EnhancedStateRef implements StateRef {
    constructor(
      public id: string,
      public path: string[] = [id],
      public componentId?: string
    ) {}
    
    /**
     * Get the full path for this reference
     */
    getFullPath(): string {
      return this.componentId ? `${this.componentId}_${this.id}` : this.id;
    }

    setComponentId(componentId: string): void {
      this.componentId = componentId;
    }
    
    /**
     * Create an expression that adds this reference and another value
     */
    add(other: PortExpressionValue): PortExpression {
      return createCompoundPortExpression('+', this, other);
    }
    
    /**
     * Create an expression that subtracts another value from this reference
     */
    subtract(other: PortExpressionValue): PortExpression {
      return createCompoundPortExpression('-', this, other);
    }
    
    /**
     * Create an expression that multiplies this reference by another value
     */
    multiply(other: PortExpressionValue): PortExpression {
      return createCompoundPortExpression('*', this, other);
    }
    
    /**
     * Create an expression that divides this reference by another value
     */
    divide(other: PortExpressionValue): PortExpression {
      return createCompoundPortExpression('/', this, other);
    }
    
    /**
     * Convert to expression
     */
    toExpression(): PortExpression {
      return new PortExpression(this.getFullPath());
    }
  }
  
  /**
   * Represents a symbolic expression
   */
  export class PortExpression {
    private _repr: string;
    private _operator?: string;
    private _left?: PortExpressionValue;
    private _right?: PortExpressionValue;
    
    /**
     * Create a simple reference or constant expression
     */
    constructor(repr: string | number);
    
    /**
     * Create a compound expression
     */
    constructor(operator: string, left: PortExpressionValue, right: PortExpressionValue);
    
    constructor(
      reprOrOperator: string | number,
      left?: PortExpressionValue,
      right?: PortExpressionValue
    ) {
      if (left === undefined) {
        // Simple expression (reference or constant)
        this._repr = String(reprOrOperator);
      } else {
        // Compound expression
        this._operator = reprOrOperator as string;
        this._left = left;
        this._right = right;
        this._repr = `(${getExpressionString(left)} ${reprOrOperator} ${getExpressionString(right as PortExpressionValue)})`;
      }
    }
    
    /**
     * Returns string representation of the expression
     */
    toString(): string {
      return this._repr;
    }
    
    /**
     * Get the operator for a compound expression
     */
    getOperator(): string | undefined {
      return this._operator;
    }
    
    /**
     * Get the left operand for a compound expression
     */
    getLeft(): PortExpressionValue | undefined {
      return this._left;
    }
    
    /**
     * Get the right operand for a compound expression
     */
    getRight(): PortExpressionValue | undefined {
      return this._right;
    }
    
    /**
     * Create an expression that adds this expression and another value
     */
    add(other: PortExpressionValue): PortExpression {
      return createCompoundPortExpression('+', this, other);
    }
  
    /**
     * Create an expression that subtracts another value from this expression
     */
    subtract(other: PortExpressionValue): PortExpression {
      return createCompoundPortExpression('-', this, other);
    }
  
    /**
     * Create an expression that multiplies this expression by another value
     */
    multiply(other: PortExpressionValue): PortExpression {
      return createCompoundPortExpression('*', this, other);
    }
  
    /**
     * Create an expression that divides this expression by another value
     */
    divide(other: PortExpressionValue): PortExpression {
      return createCompoundPortExpression('/', this, other);
    }
    
    /**
     * Static factory methods for common operations
     */
    static add(a: PortExpressionValue, b: PortExpressionValue): PortExpression {
      return createCompoundPortExpression('+', a, b);
    }
    
    static subtract(a: PortExpressionValue, b: PortExpressionValue): PortExpression {
      return createCompoundPortExpression('-', a, b);
    }
    
    static multiply(a: PortExpressionValue, b: PortExpressionValue): PortExpression {
      return createCompoundPortExpression('*', a, b);
    }
    
    static divide(a: PortExpressionValue, b: PortExpressionValue): PortExpression {
      return createCompoundPortExpression('/', a, b);
    }
  }
  
  // Type representing anything that can be used in an expression
  export type PortExpressionValue = PortExpression | StateRef | PortValue | number | string | boolean;
  
  /**
   * Helper function to get a string representation of an expression value
   */
  function getExpressionString(value: PortExpressionValue): string {
    if (value instanceof PortExpression) {
      return value.toString();
    } else if (isStateRef(value)) {
      return value.getFullPath();
    } else if (value instanceof PortValue) {
      return `port(${value.getId()})`;
    } else {
      return JSON.stringify(value);
    }
  }
  
  /**
   * Helper for creating compound expressions
   */
  function createCompoundPortExpression(
    operator: string,
    a: PortExpressionValue,
    b: PortExpressionValue
  ): PortExpression {
    return new PortExpression(operator, a, b);
  }
  
  /**
   * Type guard to check if an object is a StateRef
   */
  export function isStateRef(obj: any): obj is StateRef {
    return obj && 
           typeof obj.getFullPath === 'function' && 
           ('id' in obj);
  }
  
  /**
   * Relationship between ports and state
   */
  export type PortRelationship = {
    ref: StateRef | string;
    update: (portValue: PortValue) => PortExpression | PortExpressionValue;
  };
  
  /**
   * A shorthand relationship directly using an expression
   */
  export type ShortRelationship = PortExpression;
  
  /**
   * Configuration for a port
   */
  export type PortConfiguration = {
    port: string;
    portGroup: string;
    write?: PortRelationship[] | null; // null means no write
    read: PortRelationship | ShortRelationship | StateRef | boolean | null; // null means no read
  };
  
  /**
   * A symbolic reference to a port value
   */
  export class PortValue {
    constructor(private portId: string) {}
    
    /**
     * Get the port ID
     */
    getId(): string {
      return this.portId;
    }
    
    /**
     * Convert to an expression
     */
    toExpression(): PortExpression {
      return new PortExpression(`port(${this.portId})`);
    }
    
    /**
     * Create an expression that adds this port value and another value
     */
    add(other: PortExpressionValue): PortExpression {
      return createCompoundPortExpression('+', this, other);
    }
    
    /**
     * Create an expression that subtracts another value from this port value
     */
    subtract(other: PortExpressionValue): PortExpression {
      return createCompoundPortExpression('-', this, other);
    }
    
    /**
     * Create an expression that multiplies this port value by another value
     */
    multiply(other: PortExpressionValue): PortExpression {
      return createCompoundPortExpression('*', this, other);
    }
    
    /**
     * Create an expression that divides this port value by another value
     */
    divide(other: PortExpressionValue): PortExpression {
      return createCompoundPortExpression('/', this, other);
    }

    // may be an issue for linear constraints
    // square(): PortExpression {
    //   return createCompoundPortExpression('*', this, this);
    // }

    // sqrt(): PortExpression {
    //   return createCompoundPortExpression('sqrt', this, this);
    // }
  }
  
  /**
   * Creates a set of enhanced state references
   */
  export function createBaseState<T extends Record<string, any>>(
    schema: T,
  ): { [K in keyof T]: EnhancedStateRef } {
    const result = {} as { [K in keyof T]: EnhancedStateRef };
    
    // Create an EnhancedStateRef for each property
    for (const key in schema) {
      result[key] = new EnhancedStateRef(
        key as string,
        [key as string],
      );
    }
    
    return result;
  }
  
  /**
   * Helper to create a port value reference
   */
  export function createPortValue(portId: string): PortValue {
    return new PortValue(portId);
  }