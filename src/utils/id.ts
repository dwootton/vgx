let nextId = 0;
export function generateId(): string {
    return `node_${nextId++}`;
}
