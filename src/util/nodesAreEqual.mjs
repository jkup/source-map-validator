export function nodesAreEqual(node1, node2) {
  if (!node1 || !node2) {
    return false;
  }

  // Check if node types are the same
  if (node1.type !== node2.type) {
    return false;
  }

  // Based on type, check properties
  switch (node1.type) {
    case "Identifier":
      return node1.name === node2.name;
    case "Literal":
      return node1.value === node2.value;
    // TODO: Add more
    default:
      return false;
  }
}
