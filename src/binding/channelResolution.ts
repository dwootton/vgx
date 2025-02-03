import { EdgeResult } from "./binding";
import { PositionValueSchema , NumericPositionValueSchema} from "../types/anchors";

export const resolveValueSchema = (edgeResults: EdgeResult[]): PositionValueSchema => {
    // Check if all values are raw numbers (for numeric encodings)
    const isNumeric = edgeResults.every(result => typeof result.data.value === 'number');
  
   
  
    // Otherwise, resolve as a categorical or full schema
    return {
      scale: resolvePositionValue('scale', edgeResults) || '',
      scaleType: resolvePositionValue('scaleType', edgeResults),
      fieldName: resolvePositionValue('fieldName', edgeResults) || '',
      constraints: resolvePositionValue('constraints', edgeResults) || {},
      fieldValue: resolvePositionValue('fieldValue', edgeResults) || '',
      initialValue: resolvePositionValue('initialValue', edgeResults) || '',
    };
  };

/**
 * Resolves the value for a specific key in a `PositionValueSchema` by applying priority rules.
 * The function checks each source (`context`, `generated`, `baseContext`) in priority order
 * and returns the value of the requested key from the highest-priority source.
 *
 * @param {keyof PositionValueSchema} positionValueType - The key to resolve (e.g.,  `initialValue`,`fieldValue`,).
 * @param {EdgeResult[]} edgeResults - An array of `EdgeResult` objects representing bindings between components.
 * @returns {any} - The resolved value for the requested key, or `undefined` if no value is found.
 *
 * @example
 * const edgeResults = [
 *   {
 *     data: {
 *       source: 'context',
 *       value: { fieldValue: 150, initialValue: 100 },
 *     },
 *     type: 'y',
 *   },
 *   {
 *     data: {
 *       source: 'baseContext',
 *       value: { fieldValue: 200, initialValue: 50 },
 *     },
 *     type: 'y',
 *   },
 * ];
 *
 * const fieldValue = resolvePositionValue('fieldValue', edgeResults);
 * console.log(fieldValue); // Output: 150
 */
const resolvePositionValue = (
    positionValueType: keyof PositionValueSchema,
    edgeResults: EdgeResult[]
  ): any => {
    const priorityOrder = priorityRules[positionValueType];


  
    for (const source of priorityOrder) {
        
      const result = edgeResults.find(result => result.data.source === source);
      
      if (result) {
        const value = result.data.value;

        if(positionValueType === "scale") debugLogIfMatch(edgeResults, 'y', "scale", value, source, result);
        if (typeof value === 'object' && value !== null && positionValueType in value) {
          if(positionValueType === "scale" ) consoleIfMatch(edgeResults, value, source, result);
          return value[positionValueType];
        }
      }
    }
    return undefined; // Fallback if no value is found
  };

  function consoleIfMatch(edgeResults: EdgeResult[], value: any, source: string, result: EdgeResult) {
    if (edgeResults?.[0]?.type === 'y') {
        console.log('MATCH: value',value,'source',source,'result',result);
    }
  }
  /**
 * Logs debugging information if the provided `channel` and `positionValueType` match the specified conditions.
 *
 * @param {string} channel - The channel to match (e.g., 'y', 'x').
 * @param {string} positionValueType - The field to match (e.g., 'fieldValue', 'initialValue').
 * @param {any} value - The value to log.
 * @param {string} source - The source of the value (e.g., 'context', 'generated', 'baseContext').
 * @param {EdgeResult} result - The result object to log.
 */
const debugLogIfMatch = (
    edgeResults: EdgeResult[],
    channel: string,
    positionValueType: string,
    value: any,
    source: string,
    result: EdgeResult
  ): void => {
    if (channel === edgeResults?.[0]?.type ) {
      console.log('=== Debug Log ===');
      console.log('Channel:', channel);
      console.log('Position Value Type:', positionValueType);
      console.log('Value:', value);
      console.log('Source:', source);
      console.log('Result:', result);
      console.log('is it in',value,'positionValueType',positionValueType,'in value?', value && positionValueType in value)

      console.log('=================');
    }
  };

  export const normalizeEdgeResult = (result: EdgeResult): EdgeResult => {
    // Only normalize if the value is a raw number (for numeric encodings)
    if (typeof result.data.value === 'number') {
      return {
        ...result,
        data: {
          ...result.data,
          value: {
            fieldValue: result.data.value,
            initialValue: result.data.value,
          } as NumericPositionValueSchema,
        },
      };
    }
    return result;
  };


type PriorityOrder = ('context' | 'generated' | 'baseContext' | 'encoding')[];

const priorityRules: Record<keyof PositionValueSchema, PriorityOrder> = {
  scale: [ 'encoding','generated','context', 'baseContext'],
  scaleType: ['encoding','generated', 'context', 'baseContext'],
  fieldName: ['encoding','generated', 'context', 'baseContext'],
  constraints: ['encoding','generated', 'context', 'baseContext'],
  fieldValue: ['generated', 'context', 'encoding', 'baseContext'],
  initialValue: ['context', 'generated','encoding', 'baseContext'],
};
