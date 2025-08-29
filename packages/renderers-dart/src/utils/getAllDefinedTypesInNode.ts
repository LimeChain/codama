import { AccountNode, DefinedTypeNode, getAllDefinedTypes, pascalCase,ProgramNode } from "@codama/nodes";

/**
 * Returns a set of all struct type names defined in the given program node.
 * Used for distinguishing user-defined struct types during code generation.
 */


export type AllowedNodes = AccountNode | DefinedTypeNode | ProgramNode | null | undefined;

function getAllDefinedTypesInNode(programNode: AllowedNodes): Set<string> {
  if (!programNode) return new Set();
  // Only call getAllDefinedTypes if programNode is a ProgramNode
  if ('accounts' in programNode && 'instructions' in programNode && 'definedTypes' in programNode) {
    return new Set(getAllDefinedTypes(programNode).map(typeNode => pascalCase(typeNode.name)));
  }
  return new Set();
}

export default getAllDefinedTypesInNode;