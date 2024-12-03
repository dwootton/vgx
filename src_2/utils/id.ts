import { AnchorId } from "types/anchors";

let nextId = 0;
export function generateId(): string {
    return `node_${nextId++}`;
}


export function generateAnchorId(anchorId: AnchorId): string {
  return `${anchorId.componentId}_${anchorId.anchorId}`;
}