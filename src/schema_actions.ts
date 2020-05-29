import { OpenApiDocumentFragment } from "./types";

type PartAction = (part: OpenApiDocumentFragment) => void;
type PropertyAction = (property: string) => void;
type ItemsAction = () => void;

type SchemaActions = {
  beforeChildren?: PartAction;
  afterChildren?: PartAction;
  beforeProperty?: PropertyAction;
  afterProperty?: PropertyAction;
  beforeItems?: ItemsAction;
  afterItems?: ItemsAction;
};

/**
 * Recursively applies the functions in `transformations` to all arrays and objects below the provided `part` (including `part` itself).
 */
export function walkSchema(
  part: OpenApiDocumentFragment,
  transformations: SchemaActions
) {
  if (transformations.beforeChildren !== undefined) {
    transformations.beforeChildren(part);
  }
  if (part.type == "array") {
    if (transformations.beforeItems !== undefined) {
      transformations.beforeItems();
    }
    walkSchema(part.items, transformations);
    if (transformations.afterItems !== undefined) {
      transformations.afterItems();
    }
  } else if (part.type == "object" && "properties" in part) {
    Object.keys(part.properties).forEach((k) => {
      if (transformations.beforeProperty !== undefined) {
        transformations.beforeProperty(k);
      }
      walkSchema(part.properties[k], transformations);
      if (transformations.afterProperty !== undefined) {
        transformations.afterProperty(k);
      }
    });
  }
  if (transformations.afterChildren !== undefined) {
    transformations.afterChildren(part);
  }
}
