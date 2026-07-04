import objectHash = require("object-hash");
import pluralize = require("pluralize");

import { OpenApiDocumentFragment } from "../types";
import { walkSchema } from "./actions";

export interface CommonComponent {
  description?: string;
  name: string;
  path: string[];
}

export interface ObjectInfo {
  count: number;
  complexity: number;
  directChildren: number;
  locations: string[][];
  name?: string;
  description?: string;
  type?: string;
  enum?: boolean;
}

const externalizedBoolProperties = new Set<string>(["nullable", "deprecated"]);

function removeExternalizedBoolProperties(part: OpenApiDocumentFragment) {
  for (const prop of externalizedBoolProperties) {
    if (prop in part) {
      delete part[prop];
    }
  }
}

function commonPrefix(values: string[]): string {
  var A = values.concat().sort(),
    a1 = A[0],
    a2 = A[A.length - 1],
    L = a1.length,
    i = 0;
  while (i < L && a1.charAt(i) === a2.charAt(i)) i++;
  return a1.substring(0, i);
}

function reverseString(value: string): string {
  return value.split("").reverse().join("");
}

function extractComponentName(locations: string[][]): string {
  const deepestLocations = locations
    .filter((location) => location && location.length > 1)
    .map((location) => location[location.length - 1])
    .map(pluralize.singular);

  let name = commonPrefix(deepestLocations);
  if (!name) {
    name = reverseString(
      commonPrefix(deepestLocations.map((name) => reverseString(name))),
    );
  }

  name = name
    .toLowerCase()
    .replace(/^_+|_+$/g, "") // trim leading and trailing "_"
    .trim();

  return pluralize.singular(name);
}

function filterObject(
  obj: any,
  filter: (key: string, value: any) => boolean,
): any {
  const result: any = {};
  Object.keys(obj).forEach((key) => {
    if (filter(key, obj[key])) {
      result[key] = obj[key];
    }
  });
  return result;
}

function formatCommonComponents(
  commonComponents: CommonComponent[],
): CommonComponent[] {
  const sortedEntries = commonComponents.map((component: any) =>
    Object.keys(component)
      .sort()
      .reduce(function (result: OpenApiDocumentFragment, key) {
        result[key] = component[key];
        return result;
      }, {}),
  );

  return sortedEntries.sort((a, b) =>
    a.name?.localeCompare(b.name),
  ) as CommonComponent[];
}

function mergeSchemaComponents(
  schemas: OpenApiDocumentFragment,
  name: string,
  newSchema: OpenApiDocumentFragment,
) {
  removeExternalizedBoolProperties(newSchema);

  if (!(name in schemas)) {
    schemas[name] = newSchema;
  } else {
    // walk through both schemas[name] and newSchema in lockstep
    let newPartStack = [newSchema];
    const newSchemaPart = () => newPartStack[newPartStack.length - 1];

    walkSchema(schemas[name], {
      beforeChildren: (part) => {
        if (part.description === undefined) {
          part.description = newSchemaPart().description;
        } else if (newSchemaPart().description !== undefined) {
          if (
            !part.description.split(" | ").includes(newSchemaPart().description)
          ) {
            part.description += " | " + newSchemaPart().description;
          }
        }
      },
      beforeProperty: (property) => {
        newPartStack.push(newSchemaPart().properties[property]);
      },
      afterProperty: () => {
        newPartStack.pop();
      },
      beforeItems: () => {
        newPartStack.push(newSchemaPart().items);
      },
      afterItems: () => {
        newPartStack.pop();
      },
      beforeComposite: (compositeType, index) => {
        newPartStack.push(newSchemaPart()[compositeType][index]);
      },
      afterComposite: () => {
        newPartStack.pop();
      },
    });
  }
}

function calculateHashes(schemas: OpenApiDocumentFragment) {
  Object.keys(schemas).forEach((id) => {
    walkSchema(schemas[id], {
      afterChildren: (part) => {
        let complexity = 1;
        const hashableParts = { ...part };

        if ("items" in hashableParts && hashableParts.items !== undefined) {
          hashableParts.items = part.items["x-hash"];
          complexity += part.items["x-complexity"];
        } else if (part.type === "array") {
          console.warn(`Found array without "items"`);
        }

        if ("properties" in hashableParts && hashableParts.properties !== undefined) {
          hashableParts.properties = {};
          Object.keys(part.properties).forEach((property) => {
            hashableParts.properties[property] = part.properties[property]["x-hash"];
            complexity += part.properties[property]["x-complexity"];
          });
        }

        ["oneOf", "anyOf", "allOf"].forEach((compositeType) => {
          if (compositeType in hashableParts && Array.isArray(hashableParts[compositeType])) {
            hashableParts[compositeType] = [];
            part[compositeType].forEach((subPart: any) => {
              hashableParts[compositeType].push(subPart["x-hash"]);
              complexity += subPart["x-complexity"];
            });
          }
        });

        // Remove properties that don't affect structural identity
        const { description, example, title, ...coreHashableParts } = hashableParts;
        
        part["x-hash"] = objectHash(coreHashableParts);
        part["x-complexity"] = complexity;

        removeExternalizedBoolProperties(coreHashableParts);
        part["x-hash-no-props"] = objectHash(coreHashableParts);

        if (!("x-hash" in part)) {
          throw Error("Could not insert x-hash into part!");
        }
        if (!("x-hash-no-props" in part)) {
          throw Error("Could not insert x-hash-no-props into part!");
        }
      },
    });
  });
}

function collectObjectInfos(schemas: OpenApiDocumentFragment): {
  [hash: string]: ObjectInfo;
} {
  let objectInfos: { [hash: string]: ObjectInfo } = {};
  Object.keys(schemas).forEach((id) => {
    const location: string[] = [id];
    walkSchema(schemas[id], {
      afterChildren: (part) => {
        const isObjectLike = part.type === "object" || part.type === "string" || "properties" in part || "oneOf" in part || "allOf" in part || "anyOf" in part;
        if (isObjectLike) {
          const hash = part["x-hash-no-props"];
          if (!(hash in objectInfos)) {
            objectInfos[hash] = {
              count: 0,
              complexity: 0,
              directChildren: 0,
              locations: [],
              type: part.type,
              enum: part.enum !== undefined,
            };
          }
          objectInfos[hash].count += 1;
          objectInfos[hash].complexity = part["x-complexity"];
          
          let childrenCount = 0;
          if (part.properties !== undefined) {
            childrenCount += Object.keys(part.properties).length;
          }
          ["oneOf", "anyOf", "allOf"].forEach(c => {
            if (c in part && Array.isArray(part[c])) {
              childrenCount += part[c].length;
            }
          });
          objectInfos[hash].directChildren = childrenCount;
          
          objectInfos[hash].locations.push([...location]);
        }
      },
      beforeProperty: (property) => {
        location.push(property);
      },
      afterProperty: () => {
        location.pop();
      },
      beforeComposite: (compositeType, index) => {
        location.push(`${compositeType}[${index}]`);
      },
      afterComposite: () => {
        location.pop();
      }
    });
  });
  return objectInfos;
}

function filterAndNameComponents(
  schemas: OpenApiDocumentFragment,
  objectInfos: { [hash: string]: ObjectInfo },
  commonComponents?: CommonComponent[],
): {
  finalComponents: CommonComponent[];
  filteredObjectInfos: { [hash: string]: ObjectInfo };
} {
  // paths in schema_types.json are always considered "interesting"
  let paths_to_definitely_extract: string[] = [];
  if (commonComponents !== undefined) {
    commonComponents.forEach((component) => {
      paths_to_definitely_extract.push(component.path.join("/"));
    });
  }

  // filter for interesting objects
  let filteredObjectInfos = filterObject(
    objectInfos,
    (_key, value) =>
      (value.count > 1 &&
        Math.max.apply(
          null,
          value.locations.map((location: any) => location.length),
        ) > 1 &&
        ((value.complexity > 1 && value.directChildren > 1) || value.enum)) ||
      value.locations.some((location: any) =>
        paths_to_definitely_extract.includes(location.join("/")),
      ),
  );

  let finalComponents: CommonComponent[] = [];

  if (commonComponents !== undefined) {
    finalComponents = formatCommonComponents(commonComponents);

    commonComponents.forEach((component) => {
      Object.keys(filteredObjectInfos).forEach((hash) => {
        filteredObjectInfos[hash].locations.forEach((location: string[]) => {
          if (location.join("/") == component.path.join("/")) {
            filteredObjectInfos[hash].name = component.name;
            filteredObjectInfos[hash].description = component.description;
          }
        });
      });
    });

    filteredObjectInfos = filterObject(
      filteredObjectInfos,
      (_key, value) => value.name !== undefined,
    );
  } else {
    // compute component names for all schema objects
    const usedNames = new Set(Object.keys(schemas));
    Object.keys(filteredObjectInfos).forEach((hash) => {
      const originalName = extractComponentName(
        filteredObjectInfos[hash].locations,
      );

      let name = originalName;
      let i = 1;
      while (usedNames.has(name)) {
        name = originalName + "_" + i++;
      }

      usedNames.add(name);
      filteredObjectInfos[hash].name = name;
    });

    const computedComponents: CommonComponent[] = Object.keys(
      filteredObjectInfos,
    ).map((hash) => {
      const info = filteredObjectInfos[hash];
      const path = info.locations
        .filter((location: string[]) => location.length > 1)
        .sort((a: string[], b: string[]) => a.length - b.length)[0];
      return {
        description: "TODO",
        name: info.name as string,
        path: path,
      };
    });
    finalComponents = formatCommonComponents(computedComponents);
    console.log(
      `Extracted ${computedComponents.length} shared objects from the schemas.`,
    );
  }

  return { finalComponents, filteredObjectInfos };
}

function extractAndReplaceComponents(
  schemas: OpenApiDocumentFragment,
  objectInfos: { [hash: string]: ObjectInfo },
) {
  Object.keys(schemas).forEach((id) => {
    walkSchema(schemas[id], {
      afterChildren: (part) => {
        if (part["x-hash-no-props"] in objectInfos) {
          const info = objectInfos[part["x-hash-no-props"]];

          if (info.name == undefined) {
            throw Error("ObjectInfo without name encountered!");
          }

          const externalizedProps = Object.fromEntries(
            Array.from(externalizedBoolProperties)
              .map((prop) => [prop, (part[prop] as boolean) || undefined])
              .filter(([_, value]) => value !== undefined),
          );
          const hasExternalizedProps =
            Object.keys(externalizedProps).length > 0;
          const originalDescription = part.description;

          // store information as common component
          mergeSchemaComponents(
            schemas,
            info.name,
            JSON.parse(JSON.stringify(part)),
          );

          // remove entries from old location
          Object.keys(part).forEach((key) => {
            delete part[key];
          });

          if (hasExternalizedProps) {
            if (originalDescription) {
              part.description = originalDescription;
            }

            if (hasExternalizedProps) {
              Object.assign(part, externalizedProps);
            }
            part["allOf"] = [{ $ref: "#/components/schemas/" + info.name }];
          } else {
            // leave a reference to the common component
            part["$ref"] = "#/components/schemas/" + info.name;
          }
        }
      },
    });
  });
}

function applyOverridesAndCleanUp(
  schemas: OpenApiDocumentFragment,
  objectInfos: { [hash: string]: ObjectInfo },
) {
  // Apply specific descriptions
  Object.keys(objectInfos).forEach((hash) => {
    const info = objectInfos[hash];
    if (info.name !== undefined && info.description !== undefined) {
      if (schemas[info.name].description !== undefined) {
        console.warn(
          `Overwriting existing schema description ${info.name} ("${
            schemas[info.name].description
          }" -> "${info.description})"`,
        );
      }
      schemas[info.name].description = info.description;
    }
  });

  // Calculate ref histogram for warnings
  const refHistogram: { [ref: string]: number } = {};
  Object.keys(schemas).forEach((id) => {
    walkSchema(schemas[id], {
      afterChildren: (part) => {
        if ("$ref" in part) {
          const ref: string = part["$ref"];
          if (!(ref in refHistogram)) {
            refHistogram[ref] = 0;
          }
          refHistogram[ref] += 1;
        }
      },
    });
  });
  const singleUseEntries = Object.entries(refHistogram).filter(
    (entry) => entry[1] <= 1,
  );
  if (singleUseEntries.length > 0) {
    console.warn(
      `Found ${singleUseEntries.length} component entries which only occur once`,
    );
  }

  // Remove temporary properties
  Object.keys(schemas).forEach((id) => {
    walkSchema(schemas[id], {
      afterChildren: (part) => {
        delete part["x-hash"];
        delete part["x-complexity"];
        delete part["x-hash-no-props"];
      },
    });
  });
}

export function deduplicateSchemas(
  schemas: OpenApiDocumentFragment,
  commonComponents?: CommonComponent[],
): CommonComponent[] {
  calculateHashes(schemas);
  const objectInfos = collectObjectInfos(schemas);

  const { finalComponents, filteredObjectInfos } = filterAndNameComponents(
    schemas,
    objectInfos,
    commonComponents,
  );

  extractAndReplaceComponents(schemas, filteredObjectInfos);
  applyOverridesAndCleanUp(schemas, filteredObjectInfos);

  return finalComponents;
}
