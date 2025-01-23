import { EdgeResult } from "./binding";
import { PositionValueSchema , NumericPositionValueSchema} from "../types/anchors";

export const resolveValueSchema = (edgeResults: EdgeResult[]): PositionValueSchema => {
    // Check if all values are raw numbers (for numeric encodings)
    const isNumeric = edgeResults.every(result => typeof result.data.value === 'number');
  
    if (isNumeric) {
      return {
        scale: resolveField('scale', edgeResults) || '',
        scaleType: 'quantitative',
        fieldName: resolveField('fieldName', edgeResults) || '',
        constraints: resolveField('constraints', edgeResults) || {},
        fieldValue: resolveField('fieldValue', edgeResults) || 0,
        initialValue: resolveField('initialValue', edgeResults) || 0,
      };
    }
  
    // Otherwise, resolve as a categorical or full schema
    return {
      scale: resolveField('scale', edgeResults) || '',
      scaleType: resolveField('scaleType', edgeResults) || 'nominal',
      fieldName: resolveField('fieldName', edgeResults) || '',
      constraints: resolveField('constraints', edgeResults) || {},
      fieldValue: resolveField('fieldValue', edgeResults) || '',
      initialValue: resolveField('initialValue', edgeResults) || '',
    };
  };


  const resolveField = (
    field: keyof PositionValueSchema,
    edgeResults: EdgeResult[]
  ): any => {
    const priorityOrder = priorityRules[field];
  
    for (const source of priorityOrder) {
      const result = edgeResults.find(result => result.data.source === source);
      if (result) {
        const value = result.data.value;
        if (typeof value === 'object' && value !== null && field in value) {
          return value[field];
        }
      }
    }
  
    return undefined; // Fallback if no value is found
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
  initialValue: [ 'context', 'generated','encoding', 'baseContext'],
};
