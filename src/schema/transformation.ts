
import objectHash = require("object-hash");
import pluralize = require("pluralize");

import { OpenApiDocumentFragment } from "../types";

import { walkSchema } from "./actions";
import { assert } from "console";



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

  if (
    (part.type == "number" &&
      !allowedFloats.includes(location[location.length - 1])) ||
    (part.format !== undefined && part.format.startsWith("int"))
  ) {
    part.type = "integer";
  }

  // add additionalProperties to mark labels as key/value pairs
  if (part.type == "object" && location[location.length - 1] == "labels") {
    part["additionalProperties"] = {
      type: "string",
      pattern:
        "^(()|[a-z0-9A-Z]|([a-z0-9A-Z][a-z0-9A-Z\\._-]{0,61}[a-z0-9A-Z]))$",
    };
    delete part["properties"];
  }

  // add 52 (53?) bit maximum value for IDs
  if (
    location[location.length - 1] == "id" &&
    part.format == "int64" &&
    part.type == "integer" &&
    part.maximum == undefined
  ) {
    part.maximum = 9007199254740991;
  }

  // all firewall rules have nullable ports because some protocols do not have ports at all
  if (
    location[location.length - 1] == "port" &&
    location[location.length - 2] == "rules"
  ) {
    part.nullable = true;
  }

  // required properties in the wrong "allOf"-arm
  if (
    part.allOf !== undefined &&
    part.allOf.length == 2 &&
    part.allOf[0].type === "object" &&
    part.allOf[1].type === "object" &&
    part.allOf[1].required !== undefined
  ){

    const first = part.allOf[0];
    const second = part.allOf[1];
    let toMove = [];
    for (const r of second.required) {
      if (second.properties === undefined || !(r in second.properties)) {
        console.warn(`Found allOf sibling object with non existent required property at ${location}: ${r}`);
        toMove.push(r);
      }
    }
    for (const r of toMove) {
      second.required = second.required.filter((e: string) => e !== r)
      if (first.required === undefined) {
        first.required = [];
      }
      first.required.push(r);
    }

    if (second.required.length === 0) {
      delete second.required
    }
  }
}

export function fixDocument(obj: OpenApiDocumentFragment) {
  if (obj === null || obj === undefined) {
    return;
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      fixDocument(obj[i]);
    }
    return;
  }

  if (typeof obj === "object") {
    for (const key of Object.keys(obj)) {
      fixDocument(obj[key]);
    }
    if (obj.description !== undefined && typeof obj.description === "string") {
      obj.description = obj.description.replace(
        /\[([^\]]+)\]\(#[^\)]+\)/g,
        "$1"
      );
    }
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

export async function inlineComponents(document: OpenApiDocumentFragment) {
  // first, find all components which are just references to other components
  const components_to_inline: { [key: string]: string } = {};
  for (const [name, schema] of Object.entries(document.components.schemas)) {
    const schemaObj = schema as OpenApiDocumentFragment;
    if (Object.keys(schemaObj).length == 1 && "$ref" in schemaObj) {
      const ref: string = schemaObj["$ref"];
      assert(ref.startsWith("#/components/schemas/"));
      const refName = ref.replace("#/components/schemas/", "");
      components_to_inline[name] = refName;
    }
  }

  // then, replace all references to those components with the referenced component directly
  walkSchema(document.components.schemas, {
    afterChildren: (part) => {
      if ("$ref" in part) {
        const ref: string = part["$ref"];
        assert(ref.startsWith("#/components/schemas/"));
        const refName = ref.replace("#/components/schemas/", "");
        if (refName in components_to_inline) {
          const newRefName = components_to_inline[refName];
          part["$ref"] = "#/components/schemas/" + newRefName;
        }
      }
    },
  });
  const paths = document.paths as OpenApiDocumentFragment;
  for (const [path, path_obj] of Object.entries(paths)) {
    const base_url = path_obj.servers[0].url;
    for (const [verb, verb_obj] of Object.entries(path_obj)) {
      const verb_data = verb_obj as OpenApiDocumentFragment;
      if (verb_data.requestBody !== undefined) {
        const request_body = verb_data.requestBody as OpenApiDocumentFragment;
        const content = request_body.content as OpenApiDocumentFragment;
        const schema_data = content?.["application/json"]?.schema as
          | OpenApiDocumentFragment
          | undefined;
        if (schema_data !== undefined && "$ref" in schema_data) {
          const ref: string = schema_data["$ref"];
          assert(ref.startsWith("#/components/schemas/"));
          const refName = ref.replace("#/components/schemas/", "");
          if (refName in components_to_inline) {
            const newRefName = components_to_inline[refName];
            schema_data["$ref"] = "#/components/schemas/" + newRefName;
          }
        }
      }

      if (verb_data.responses !== undefined) {
        for (const [_, response_obj] of Object.entries(verb_data.responses)) {
          const response_data = response_obj as OpenApiDocumentFragment;
          const schema_data = response_data?.content?.["application/json"]
            ?.schema as OpenApiDocumentFragment | undefined;
          if (schema_data !== undefined && "$ref" in schema_data) {
            const ref: string = schema_data["$ref"];
            assert(ref.startsWith("#/components/schemas/"));
            const refName = ref.replace("#/components/schemas/", "");
            if (refName in components_to_inline) {
              const newRefName = components_to_inline[refName];
              schema_data["$ref"] = "#/components/schemas/" + newRefName;
            }
          }
        }
      }
    }
  }

  // finally, remove the inlined components from the document
  for (const name of Object.keys(components_to_inline)) {
    delete document.components.schemas[name];
  }
}
