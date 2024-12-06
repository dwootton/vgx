import { compilationContext } from "../types/compilation";

export function generateParams(compilationContext:compilationContext){
    const entries = Object.entries(compilationContext)
        .map(([key, expr]) => `'${key}':${expr}`)
        .join(',');
    return `{${entries}}`;
}
