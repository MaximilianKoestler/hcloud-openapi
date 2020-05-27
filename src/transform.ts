import { OpenApiDocumentFragment } from "./types";

/**
 * Recursively applies the `fixer` function to all arrays and objects below the
 * provided `part`.
 */
function applyFix(
  id: string,
  part: OpenApiDocumentFragment,
  fixer: (id: string, part: OpenApiDocumentFragment) => void
) {
  if (part.type == "array") {
    applyFix(id, part.items, fixer);
  } else if (part.type == "object" && "properties" in part) {
    Object.keys(part.properties).forEach((k) =>
      applyFix(id, part.properties[k], fixer)
    );
  }
  fixer(id, part);
}

export function applyFixes(id: string, schema: OpenApiDocumentFragment) {
  // fix "items" in array form (they may only appear as objects)
  applyFix(id, schema[id], (id, part) => {
    if (part.type == "array" && "items" in part && Array.isArray(part.items)) {
      console.warn(`Found array "items" in ${id}`);
      part.items = part.items[0];
    }
  });

  // remove forbidden segments
  //   - definitions: is not needed because all schemas are dereferenced and
  //                  this property is not compatible to the OpenAPI standard
  applyFix(id, schema[id], (id, part) => {
    const forbiddenSegments = ["definitions"];
    forbiddenSegments.forEach((segment) => {
      if (segment in part) {
        console.warn(`Removing forbidden segment "${segment}" in ${id}`);
        delete part[segment];
      }
    });
  });
}
