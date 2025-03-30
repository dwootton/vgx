export function getEncodingValue(
    channel: string,
    constraintMap: Record<string, any>,
    componentId: string
): { expr: string } {
    const constraint = constraintMap[channel]?.[0];
    
    // If constraint exists and contains 'datum[', use it directly
    if (constraint ) {
        return { expr: constraint };
    }
    
    // Otherwise, use the standard component-based access
    return { expr: `${componentId}_position_${channel}` };
} 