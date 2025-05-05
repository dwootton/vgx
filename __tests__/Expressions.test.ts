/**
 * Jest Tests for Symbolic Expression System
 * 
 * These tests focus on the expression structure and creation capabilities,
 * as well as conversion to Kiwi constraints.
 */

import {
    StateRef,
    EnhancedStateRef,
    PortExpression,
    PortValue,
    createBaseState,
    createPortValue
  } from '../src/components/portExpressions';
  
  import {
    KiwiManager,
    createKiwiRelationship,
    createEqualConstraint
  } from '../src/components/kiwiExpressionConverter';
  
  // Mock the kiwi.js dependencies
  jest.mock('@lume/kiwi', () => {
    // Create a mock version of the kiwi API
    const mockVariable = jest.fn().mockImplementation((name) => ({
      name: () => name,
      value: jest.fn().mockReturnValue(0),
      setValue: jest.fn()
    }));
    
    const mockExpression = jest.fn().mockImplementation((value) => ({
      value: () => value,
      terms: () => [],
      constant: () => typeof value === 'number' ? value : 0,
      plus: jest.fn().mockImplementation(() => mockExpression(0)),
      minus: jest.fn().mockImplementation(() => mockExpression(0)),
      multiply: jest.fn().mockImplementation(() => mockExpression(0)),
      divide: jest.fn().mockImplementation(() => mockExpression(0))
    }));
    
    const mockConstraint = jest.fn().mockImplementation(() => ({
      expression: mockExpression(0),
      operator: 'eq',
      strength: 1000
    }));
    
    const mockSolver = jest.fn().mockImplementation(() => ({
      addConstraint: jest.fn(),
      removeConstraint: jest.fn(),
      updateVariables: jest.fn()
    }));
    
    return {
      Variable: mockVariable,
      Expression: mockExpression,
      Constraint: mockConstraint,
      Solver: mockSolver,
      Operator: {
        Eq: 'eq',
        Le: 'le',
        Ge: 'ge'
      },
      Strength: {
        required: 1000,
        strong: 750,
        medium: 500,
        weak: 250
      }
    };
  });
  
  describe('Symbolic Expression System', () => {
    describe('StateRef and EnhancedStateRef', () => {
      test('creates symbolic references with correct paths', () => {
        const stateRef = new EnhancedStateRef('width', ['width'], 'rect1');
        
        expect(stateRef.id).toBe('width');
        expect(stateRef.componentId).toBe('rect1');
        expect(stateRef.getFullPath()).toBe('rect1_width');
      });
      
      test('creates base state with multiple properties', () => {
        const rect = createBaseState({
          x1: null,
          y1: null,
          x2: null,
          y2: null
        });
        rect.x1.setComponentId('rect1');
        rect.y1.setComponentId('rect1');
        rect.x2.setComponentId('rect1');
        rect.y2.setComponentId('rect1');

        
        expect(rect.x1.id).toBe('x1');
        expect(rect.x1.getFullPath()).toBe('rect1_x1');
        expect(rect.x2.getFullPath()).toBe('rect1_x2');
        expect(rect.y1.getFullPath()).toBe('rect1_y1');
        expect(rect.y2.getFullPath()).toBe('rect1_y2');
      });
    });
    
    describe('PortExpression', () => {
      test('creates simple reference expressions', () => {
        const expr = new PortExpression('rect1_width');
        
        expect(expr.toString()).toBe('rect1_width');
      });
      
      test('creates constant expressions', () => {
        const expr = new PortExpression(42);
        
        expect(expr.toString()).toBe('42');
      });
      
      test('creates compound expressions', () => {
        const expr = new PortExpression('+', new PortExpression('a'), new PortExpression('b'));
        
        expect(expr.toString()).toBe('(a + b)');
        expect(expr.getOperator()).toBe('+');
        
        const left = expr.getLeft();
        const right = expr.getRight();
        
        expect(left instanceof PortExpression).toBe(true);
        expect(right instanceof PortExpression).toBe(true);
        
        if (left instanceof PortExpression && right instanceof PortExpression) {
          expect(left.toString()).toBe('a');
          expect(right.toString()).toBe('b');
        }
      });
      
      test('combines expressions with operators', () => {
        const a = new PortExpression('a');
        const b = new PortExpression('b');
        
        const sum = a.add(b);
        const diff = a.subtract(b);
        const product = a.multiply(b);
        const quotient = a.divide(b);
        
        expect(sum.toString()).toBe('(a + b)');
        expect(diff.toString()).toBe('(a - b)');
        expect(product.toString()).toBe('(a * b)');
        expect(quotient.toString()).toBe('(a / b)');
      });
      
      test('creates complex nested expressions', () => {
        const a = new PortExpression('a');
        const b = new PortExpression('b');
        const c = new PortExpression('c');
        
        // (a + b) * (c - a) / 2
        const expr = a.add(b).multiply(c.subtract(a)).divide(2);
        
        expect(expr.toString()).toBe('(((a + b) * (c - a)) / 2)');
      });
      
      test('static factory methods create correct expressions', () => {
        const a = new PortExpression('a');
        const b = new PortExpression('b');
        
        const sum = PortExpression.add(a, b);
        const diff = PortExpression.subtract(a, b);
        const product = PortExpression.multiply(a, b);
        const quotient = PortExpression.divide(a, b);
        
        expect(sum.toString()).toBe('(a + b)');
        expect(diff.toString()).toBe('(a - b)');
        expect(product.toString()).toBe('(a * b)');
        expect(quotient.toString()).toBe('(a / b)');
      });
      
      test('can mix different types in expressions', () => {
        const a = new PortExpression('a');
        const stateRef = new EnhancedStateRef('b', ['b'], 'rect1');
        const portValue = createPortValue('c');
        const number = 42;
        
        // a + rect1_b - port(c) * 42
        const expr = a.add(stateRef).subtract(portValue.multiply(number));
        
        expect(expr.toString()).toBe('((a + rect1_b) - (port(c) * 42))');
      });
    });
    
    describe('EnhancedStateRef expressions', () => {
      test('creates expressions from EnhancedStateRef', () => {
        const rect = createBaseState({
          x1: null,
          x2: null
        });
        rect.x1.setComponentId('rect1');
        rect.x2.setComponentId('rect1');
        
        // width = x2 - x1
        const width = rect.x2.subtract(rect.x1);
        
        expect(width.toString()).toBe('(rect1_x2 - rect1_x1)');
      });
      
      test('creates complex expressions from rectangle properties', () => {
        const rect = createBaseState({
          x1: null,
          y1: null,
          x2: null,
          y2: null
        });

        rect.x1.setComponentId('rect1');
        rect.y1.setComponentId('rect1');
        rect.x2.setComponentId('rect1');
        rect.y2.setComponentId('rect1');
        
        // width = x2 - x1
        const width = rect.x2.subtract(rect.x1);
        
        // height = y2 - y1
        const height = rect.y2.subtract(rect.y1);
        
        // area = width * height
        const area = width.multiply(height);
        
        // perimeter = 2 * (width + height)
        const perimeter = PortExpression.multiply(2, width.add(height));
        
        // midX = x1 + width/2
        const midX = rect.x1.add(width.divide(2));
        
        expect(width.toString()).toBe('(rect1_x2 - rect1_x1)');
        expect(height.toString()).toBe('(rect1_y2 - rect1_y1)');
        expect(area.toString()).toBe('((rect1_x2 - rect1_x1) * (rect1_y2 - rect1_y1))');
        expect(perimeter.toString()).toBe('(2 * ((rect1_x2 - rect1_x1) + (rect1_y2 - rect1_y1)))');
        expect(midX.toString()).toBe('(rect1_x1 + ((rect1_x2 - rect1_x1) / 2))');
      });
    });
    
    describe('PortValue', () => {
      test('creates port value references', () => {
        const portValue = createPortValue('width');
        
        expect(portValue.getId()).toBe('width');
        expect(portValue.toExpression().toString()).toBe('port(width)');
      });
      
      test('creates expressions with port values', () => {
        const portValue = createPortValue('width');
        const height = 10;
        
        // area = width * height
        const area = portValue.multiply(height);
        
        expect(area.toString()).toBe('(port(width) * 10)');
      });
    });
    
    describe('Kiwi Conversion', () => {
      let kiwiManager: KiwiManager;
      
      beforeEach(() => {
        kiwiManager = new KiwiManager();
      });
      
      test('registers state references with the manager', () => {
        const rect = createBaseState({
          x1: null,
          y1: null,
          x2: null,
          y2: null
        });

        // Set component ID for each state ref in rect, done in tests
        rect.x1.setComponentId('rect1');
        rect.y1.setComponentId('rect1');
        rect.x2.setComponentId('rect1');
        rect.y2.setComponentId('rect1');
        
        // Spy on the internal map
        const setSpy = jest.spyOn((kiwiManager as any).stateRefs, 'set');
        
        kiwiManager.registerStateRefs(rect);
        
        // Should have registered 4 state refs
        expect(setSpy).toHaveBeenCalledTimes(4);
        
        // Check if specifically registering one works
        kiwiManager.registerStateRef(rect.x1);
        expect(setSpy).toHaveBeenCalledWith('rect1_x1', rect.x1);
      });
      
      test('creates Kiwi variables for state references', () => {
        const rect = createBaseState({
          x1: null,
          x2: null
        });

        rect.x1.setComponentId('rect1');
        rect.x2.setComponentId('rect1');
        
        kiwiManager.registerStateRefs(rect);
        
        // Get variables for the references
        const x1Var = kiwiManager.getVariable(rect.x1);
        const x2Var = kiwiManager.getVariable(rect.x2);

        
        // Check names match, no rect in prefix because this is a kiwivariable, not a component yet.
        expect(x1Var.name()).toBe('rect1_x1');
        expect(x2Var.name()).toBe('rect1_x2');
      });
      
      
      test('adds constraints from expressions', () => {
        const rect = createBaseState({
          x1: null,
          x2: null
        });

        rect.x1.setComponentId('rect1');
        rect.x2.setComponentId('rect1');
        
        kiwiManager.registerStateRefs(rect);
        
        // width = x2 - x1
        const width = rect.x2.subtract(rect.x1);
        
        // Spy on solver.addConstraint
        const addConstraintSpy = jest.spyOn((kiwiManager as any).solver, 'addConstraint');
        
        // Add constraint: width = 100
        createEqualConstraint(kiwiManager, width, 100);
        
        // Should have added a constraint
        expect(addConstraintSpy).toHaveBeenCalled();
      });
      
      test('creates constraint relationships', () => {
        const rect = createBaseState({
          x1: null,
          x2: null
        });

        rect.x1.setComponentId('rect1');
        rect.x2.setComponentId('rect1');
        
        kiwiManager.registerStateRefs(rect);
        
        // width = x2 - x1
        const width = rect.x2.subtract(rect.x1);
        
        // Create a port value for midpoint
        const midXPort = createPortValue('midX');
        
        // Create a relationship for x1 based on midpoint
        const midX1Relationship = createKiwiRelationship(
          rect.x1,
          (midX: PortValue) => midX.subtract(width.divide(2))
        );
        
        // The relationship should have correct structure
        expect(midX1Relationship.ref).toBe(rect.x1);
        expect(typeof midX1Relationship.update).toBe('function');
        
        // Test the update function
        const expr = midX1Relationship.update(midXPort);
        expect(expr.toString()).toBe('(port(midX) - ((rect1_x2 - rect1_x1) / 2))');
        
        // Spy on solver.addConstraint
        const addConstraintSpy = jest.spyOn((kiwiManager as any).solver, 'addConstraint');
        
        // Add constraint from relationship
        kiwiManager.addConstraintFromRelationship(rect.x1, midX1Relationship, midXPort);
        
        // Should have added a constraint
        expect(addConstraintSpy).toHaveBeenCalled();
      });
    });
  });