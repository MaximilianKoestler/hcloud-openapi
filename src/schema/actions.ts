import { OpenApiDocumentFragment } from "../types";

type PartAction = (part: OpenApiDocumentFragment) => void;
type PropertyAction = (property: string) => void;
type ItemsAction = () => void;

type CompositeAction = (compositeType: "oneOf" | "anyOf" | "allOf", index: number) => void;

type SchemaActions = {
  beforeChildren?: PartAction;
  afterChildren?: PartAction;
  beforeProperty?: PropertyAction;
  afterProperty?: PropertyAction;
  beforeItems?: ItemsAction;
  afterItems?: ItemsAction;
  beforeComposite?: CompositeAction;
  afterComposite?: CompositeAction;
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
  if ("items" in part) {
    if (transformations.beforeItems !== undefined) {
      transformations.beforeItems();
    }
    if (part.items !== undefined) {
      walkSchema(part.items, transformations);
    }
    if (transformations.afterItems !== undefined) {
      transformations.afterItems();
    }
  }
  
  if ("properties" in part && part.properties !== undefined) {
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

  ["oneOf", "anyOf", "allOf"].forEach((compositeType) => {
    const cType = compositeType as "oneOf" | "anyOf" | "allOf";
    if (cType in part && Array.isArray(part[cType])) {
      part[cType].forEach((subPart: any, index: number) => {
        if (transformations.beforeComposite !== undefined) {
          transformations.beforeComposite(cType, index);
        }
        walkSchema(subPart, transformations);
        if (transformations.afterComposite !== undefined) {
          transformations.afterComposite(cType, index);
        }
      });
    }
  });
  if (transformations.afterChildren !== undefined) {
    transformations.afterChildren(part);
  }
}
