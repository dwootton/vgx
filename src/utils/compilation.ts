
export function generateParams(compilationContext:any){
    const entries = Object.entries(compilationContext)
        .map(([key, expr]) => `'${key}':${expr}`)
        .join(',');
    return `{${entries}}`;
}
