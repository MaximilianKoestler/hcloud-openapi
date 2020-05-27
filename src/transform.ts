import hash = require("object-hash");

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

export function fixSchema(id: string, schemas: OpenApiDocumentFragment) {
  // fix "items" in array form (they may only appear as objects)
  walkSchema(schemas[id], {
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
  walkSchema(schemas[id], {
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

export function deduplicateSchemas(schemas: OpenApiDocumentFragment) {
  // calculate hashes over all possibly shared schema items
  // do not consider descriptions for these hashes
  Object.keys(schemas).forEach((id) => {
    walkSchema(schemas[id], {
      afterChildren: (part) => {
        if (part.type == "array") {
          if (part.items !== undefined) {
            const { description, items, ...hashableParts } = part;
            hashableParts.items = items["x-hash"];
            part["x-hash"] = hash(hashableParts);
          } else {
            console.warn(`Found array without "items"`);
            const { description, ...hashableParts } = part;
            part["x-hash"] = hash(hashableParts);
          }
        } else if (part.type == "object") {
          if (part.properties !== undefined) {
            const { description, properties, ...hashableParts } = part;
            hashableParts.properties = {};
            Object.keys(properties).forEach((property) => {
              hashableParts.properties[property] =
                properties[property]["x-hash"];
            });
            part["x-hash"] = hash(hashableParts);
          } else {
            const { description, ...hashableParts } = part;
            part["x-hash"] = hash(hashableParts);
          }
        } else {
          const { description, ...hashableParts } = part;
          part["x-hash"] = hash(hashableParts);
        }

        if (!("x-hash" in part)) {
          throw Error("Could not insert x-hash into part!");
        }
      },
    });
  });

  // TODO: deduplicate based on x-hash

  // remove hashes again
  Object.keys(schemas).forEach((id) => {
    walkSchema(schemas[id], {
      afterChildren: (part) => {
        if ("x-hash" in part) {
          delete part["x-hash"];
        }
      },
    });
  });
}
