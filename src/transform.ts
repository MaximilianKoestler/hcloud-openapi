import { OpenApiDocumentFragment } from "./types";

type Transformation = (part: OpenApiDocumentFragment) => void;

type SchemaTransformations = {
  beforeChildren?: Transformation;
  afterChildren?: Transformation;
};

/**
 * Recursively applies the functions in `transformations` to all arrays and objects below the provided `part` (including `part` itself).
 */
function walkSchema(
  part: OpenApiDocumentFragment,
  transformations: SchemaTransformations
) {
  if (transformations.beforeChildren !== undefined) {
    transformations.beforeChildren(part);
  }
  if (part.type == "array") {
    walkSchema(part.items, transformations);
  } else if (part.type == "object" && "properties" in part) {
    Object.keys(part.properties).forEach((k) =>
      walkSchema(part.properties[k], transformations)
    );
  }
  if (transformations.afterChildren !== undefined) {
    transformations.afterChildren(part);
  }
}

export function fixSchema(id: string, schema: OpenApiDocumentFragment) {
  // fix "items" in array form (they may only appear as objects)
  walkSchema(schema[id], {
    afterChildren: (part) => {
      if (
        part.type == "array" &&
        "items" in part &&
        Array.isArray(part.items)
      ) {
        console.warn(`Found array "items" in ${id}`);
        part.items = part.items[0];
      }
    },
  });

  // remove forbidden segments
  //   - definitions: is not needed because all schemas are dereferenced and
  //                  this property is not compatible to the OpenAPI standard
  walkSchema(schema[id], {
    afterChildren: (part) => {
      const forbiddenSegments = ["definitions"];
      forbiddenSegments.forEach((segment) => {
        if (segment in part) {
          console.warn(`Removing forbidden segment "${segment}" in ${id}`);
          delete part[segment];
        }
      });
    },
  });
}
