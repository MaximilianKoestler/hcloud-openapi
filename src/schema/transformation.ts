const fs = require("fs").promises;

import objectHash = require("object-hash");
import pluralize = require("pluralize");

import { OpenApiDocumentFragment } from "../types";

import { walkSchema } from "./actions";

interface CommonComponent {
  description?: string;
  name: string;
  path: string[];
}

function fixItem(part: OpenApiDocumentFragment, location: string[]) {
  // deprecation markers are always nullable
  if (location[location.length - 1] == "deprecated" && part.type == "boolean") {
    part.nullable = true;
  }

  // array "items" must not be an empty object
  if (part.type == "array" && Object.keys(part.items).length == 0) {
    part.items = {
      type: "object",
      properties: {},
    };
  }

  // sort enumeration entries
  if (part.type == "string" && part.enum !== undefined) {
    part.enum = (part.enum as string[]).sort();
  }

  // we assume that all numbers are integers by default
  const allowedFloats = [
    "disk_size",
    "disk",
    "image_size",
    "latitude",
    "longitude",
    "memory",
    "progress",
    "size",
  ];

  const longIntegers = [
    "included_traffic",
    "ingoing_traffic",
    "outgoing_traffic",
  ];
  if (
    part.type == "number" &&
    !allowedFloats.includes(location[location.length - 1])
  ) {
    part.type = "integer";
  }

  if (
    part.type == "integer" &&
    longIntegers.includes(location[location.length - 1])
  ) {
    part.format = "int64";
  }

  // add additionalProperties to mark labels as key/value pairs
  if (
    part.type == "object" &&
    location[location.length - 1] == "labels" &&
    part.properties !== undefined &&
    (Object.keys(part.properties).length == 0 || "labelkey" in part.properties)
  ) {
    part["additionalProperties"] = {
      type: "string",
      pattern:
        "^(()|[a-z0-9A-Z]|([a-z0-9A-Z][a-z0-9A-Z\\._-]{0,61}[a-z0-9A-Z]))$",
    };
    delete part["properties"];
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

  // call `fixItem()` function with the path for each item, allowing more local
  // changes
  const location: string[] = [id];
  walkSchema(schemas[id], {
    afterChildren: (part) => {
      fixItem(part, location);
    },
    beforeProperty: (property) => {
      location.push(property);
    },
    afterProperty: () => {
      location.pop();
    },
  });
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
      commonPrefix(deepestLocations.map((name) => reverseString(name)))
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
  filter: (key: string, value: any) => boolean
): any {
  const result: any = {};
  Object.keys(obj).forEach((key) => {
    if (filter(key, obj[key])) {
      result[key] = obj[key];
    }
  });
  return result;
}

async function storeCommonComponents(commonComponents: CommonComponent[]) {
  const sortedEntries = commonComponents.map((component: any) =>
    Object.keys(component)
      .sort()
      .reduce(function (result: OpenApiDocumentFragment, key) {
        result[key] = component[key];
        return result;
      }, {})
  );

  await fs.writeFile(
    "resources/schema_types.json",
    JSON.stringify(
      sortedEntries.sort((a, b) => a.name?.localeCompare(b.name)),
      null,
      2
    ),
    "utf-8"
  );
}

/**
 * Merge a schema which was found somewhere in the document with an identical
 * schema in the "components" section.
 * This attempts to combine the different "description" messages from all
 * encountered variants.
 * @param schemas Section of the OpenAPI specification containing all schemas
 * @param name Name of the shared component
 * @param newSchema Newly found instance of the component with name "name".
 *                  Will be merged with the existing component (if exists).
 */
function mergeSchemaComponents(
  schemas: OpenApiDocumentFragment,
  name: string,
  newSchema: OpenApiDocumentFragment
) {
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
    });
  }
}

export async function deduplicateSchemas(
  schemas: OpenApiDocumentFragment,
  fromFile: boolean
) {
  // calculate hashes and complexity scores over all possibly shared schema items
  // do not consider descriptions for the hashes
  Object.keys(schemas).forEach((id) => {
    walkSchema(schemas[id], {
      afterChildren: (part) => {
        if (part.type == "array") {
          if (part.items !== undefined) {
            const { description, example, items, ...hashableParts } = part;
            hashableParts.items = items["x-hash"];
            part["x-hash"] = objectHash(hashableParts);
            part["x-complexity"] = items["x-complexity"] + 1;
          } else {
            console.warn(`Found array without "items"`);
            const { description, example, ...hashableParts } = part;
            part["x-hash"] = objectHash(hashableParts);
            part["x-complexity"] = 1;
          }
        } else if (part.type == "object") {
          if (part.properties !== undefined) {
            const {
              description,
              example,
              properties,
              title,
              ...hashableParts
            } = part;
            hashableParts.properties = {};
            Object.keys(properties).forEach((property) => {
              hashableParts.properties[property] =
                properties[property]["x-hash"];
            });
            part["x-hash"] = objectHash(hashableParts);
            part["x-complexity"] = Object.values(properties).reduce(
              (value: number, element: any) => value + element["x-complexity"],
              1
            );
          } else {
            const { description, example, ...hashableParts } = part;
            part["x-hash"] = objectHash(hashableParts);
            part["x-complexity"] = 1;
          }
        } else {
          const { description, example, ...hashableParts } = part;
          part["x-hash"] = objectHash(hashableParts);
          part["x-complexity"] = 1;
        }

        if (!("x-hash" in part)) {
          throw Error("Could not insert x-hash into part!");
        }
      },
    });
  });

  interface ObjectInfo {
    count: number;
    complexity: number;
    directChildren: number;
    locations: string[][];
    name?: string;
    description?: string;
  }

  let objectInfos: { [hash: string]: ObjectInfo } = {};
  Object.keys(schemas).forEach((id) => {
    const location: string[] = [id];
    walkSchema(schemas[id], {
      afterChildren: (part) => {
        if (part.type == "object") {
          const hash = part["x-hash"];
          if (!(hash in objectInfos)) {
            objectInfos[hash] = {
              count: 0,
              complexity: 0,
              directChildren: 0,
              locations: [],
            };
          }
          objectInfos[hash].count += 1;
          objectInfos[hash].complexity = part["x-complexity"];
          objectInfos[hash].directChildren =
            part.properties !== undefined
              ? Object.keys(part.properties).length
              : 0;
          objectInfos[hash].locations.push([...location]);
        }
      },
      beforeProperty: (property) => {
        location.push(property);
      },
      afterProperty: () => {
        location.pop();
      },
    });
  });

  // paths in schema_types.json are always considered "interesting"
  let paths_to_definitely_extract: string[] = [];
  if (fromFile) {
    const json = await fs.readFile("resources/schema_types.json", "utf-8");
    let commonComponents: CommonComponent[] = JSON.parse(json);
    commonComponents.forEach((component) => {
      paths_to_definitely_extract.push(component.path.join("/"));
    });
  }

  // filter for interesting objects
  objectInfos = filterObject(
    objectInfos,
    (_key, value) =>
      (value.count > 1 &&
        value.complexity > 1 &&
        value.directChildren > 1 &&
        Math.max.apply(
          null,
          value.locations.map((location: any) => location.length)
        ) > 1) ||
      value.locations.some((location: any) =>
        paths_to_definitely_extract.includes(location.join("/"))
      )
  );

  if (fromFile) {
    // load component names from file
    const json = await fs.readFile("resources/schema_types.json", "utf-8");
    let commonComponents: CommonComponent[] = JSON.parse(json);
    storeCommonComponents(commonComponents);

    commonComponents.forEach((component) => {
      Object.keys(objectInfos).forEach((hash) => {
        objectInfos[hash].locations.forEach((location) => {
          if (location.join("/") == component.path.join("/")) {
            objectInfos[hash].name = component.name;
            objectInfos[hash].description = component.description;
          }
        });
      });
    });

    objectInfos = filterObject(
      objectInfos,
      (_key, value) => value.name !== undefined
    );
  } else {
    // compute component names for all schema objects
    const usedNames = new Set(Object.keys(schemas));
    Object.keys(objectInfos).forEach((hash) => {
      const originalName = extractComponentName(objectInfos[hash].locations);

      let name = originalName;
      let i = 1;
      while (usedNames.has(name)) {
        name = originalName + "_" + i++;
      }

      usedNames.add(name);
      objectInfos[hash].name = name;
    });

    const commonComponents: CommonComponent[] = Object.keys(objectInfos).map(
      (hash) => {
        const info = objectInfos[hash];
        const path = info.locations
          .filter((location) => location.length > 1)
          .sort((a, b) => a.length - b.length)[0];
        return {
          description: "TODO",
          name: info.name as string,
          path: path,
        };
      }
    );
    storeCommonComponents(commonComponents);
    console.log(
      `Extracted ${commonComponents.length} shared objects from the schemas.`
    );
  }

  Object.keys(schemas).forEach((id) => {
    walkSchema(schemas[id], {
      afterChildren: (part) => {
        if (part["x-hash"] in objectInfos) {
          const info = objectInfos[part["x-hash"]];

          if (info.name == undefined) {
            throw Error("ObjectInfo without name encountered!");
          }

          // store information as common component
          mergeSchemaComponents(
            schemas,
            info.name,
            JSON.parse(JSON.stringify(part))
          );
          // remove entries from old location
          Object.keys(part).forEach((key) => {
            delete part[key];
          });
          // leave a reference to the common component
          part["$ref"] = "#/components/schemas/" + info.name;
        }
      },
    });
  });

  Object.keys(objectInfos).forEach((hash) => {
    const info = objectInfos[hash];
    if (info.name !== undefined && info.description !== undefined) {
      if (schemas[info.name].description !== undefined) {
        console.warn(
          `Overwriting existing schema description ${info.name} ("${
            schemas[info.name].description
          }" -> "${info.description})"`
        );
      }
      schemas[info.name].description = info.description;
    }
  });

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
    (entry) => entry[1] <= 1
  );
  if (singleUseEntries.length > 0) {
    console.warn(
      `Found ${singleUseEntries.length} component entries which only occur once`
    );
    // console.warn(singleUseEntries);
  }

  // remove hashes again
  Object.keys(schemas).forEach((id) => {
    walkSchema(schemas[id], {
      afterChildren: (part) => {
        delete part["x-hash"];
        delete part["x-complexity"];
      },
    });
  });
}
