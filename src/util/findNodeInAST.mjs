import _traverse from "@babel/traverse";
const traverse = _traverse.default;

export function findNodeInAST(ast, line, column) {
  let foundNode = null;
  traverse(ast, {
    enter(path) {
      if (
        path.node.loc.start.line === line &&
        path.node.loc.start.column === column
      ) {
        foundNode = path.node;
        path.stop(); // Stop traversal once the node is found
      }
    },
  });
  return foundNode;
}
