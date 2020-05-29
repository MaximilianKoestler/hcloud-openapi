import objectHash = require("object-hash");
import pluralize = require("pluralize");

import { OpenApiDocumentFragment } from "./types";

import { walkSchema } from "./schema_actions";

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

export function deduplicateSchemas(schemas: OpenApiDocumentFragment) {
  // calculate hashes and complexity scores over all possibly shared schema items
  // do not consider descriptions for the hashes
  Object.keys(schemas).forEach((id) => {
    walkSchema(schemas[id], {
      afterChildren: (part) => {
        if (part.type == "array") {
          if (part.items !== undefined) {
            const { description, items, ...hashableParts } = part;
            hashableParts.items = items["x-hash"];
            part["x-hash"] = objectHash(hashableParts);
            part["x-complexity"] = items["x-complexity"] + 1;
          } else {
            console.warn(`Found array without "items"`);
            const { description, ...hashableParts } = part;
            part["x-hash"] = objectHash(hashableParts);
            part["x-complexity"] = 1;
          }
        } else if (part.type == "object") {
          if (part.properties !== undefined) {
            const { description, properties, ...hashableParts } = part;
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
            const { description, ...hashableParts } = part;
            part["x-hash"] = objectHash(hashableParts);
            part["x-complexity"] = 1;
          }
        } else {
          const { description, ...hashableParts } = part;
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
  }

  const objectInfos: { [hash: string]: ObjectInfo } = {};
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

  // filter for interesting objects
  const filteredObjectInfos: { [hash: string]: ObjectInfo } = {};
  Object.keys(objectInfos).forEach((hash) => {
    if (
      objectInfos[hash].count > 2 &&
      objectInfos[hash].complexity > 1 &&
      objectInfos[hash].directChildren > 1 &&
      Math.max.apply(
        null,
        objectInfos[hash].locations.map((location) => location.length)
      ) > 1
    ) {
      filteredObjectInfos[hash] = objectInfos[hash];
    }
  });

  // select component names for all schema objects
  const usedNames = new Set(Object.keys(schemas));
  Object.keys(filteredObjectInfos).forEach((hash) => {
    const originalName = extractComponentName(
      filteredObjectInfos[hash].locations
    );

    let name = originalName;
    let i = 1;
    while (usedNames.has(name)) {
      name = originalName + "_" + i++;
    }

    usedNames.add(name);
    filteredObjectInfos[hash].name = name;
  });

  Object.keys(schemas).forEach((id) => {
    walkSchema(schemas[id], {
      afterChildren: (part) => {
        if (part["x-hash"] in filteredObjectInfos) {
          const info = filteredObjectInfos[part["x-hash"]];

          if (info.name == undefined) {
            throw Error("ObjectInfo without name encountered!");
          }

          schemas[info.name] = JSON.parse(JSON.stringify(part));
          Object.keys(part).forEach((key) => {
            delete part[key];
          });
          part["$ref"] = "#/components/schemas/" + info.name;
        }
      },
    });
  });

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
