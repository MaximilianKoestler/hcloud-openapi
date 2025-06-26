#!/usr/bin/env node
const fs = require("fs").promises;

import needle = require("needle");
import validator = require("ibm-openapi-validator");
import validUrl = require("valid-url");
import yargs = require("yargs");

import { addPagination } from "./document/pagination";
import { transformDocument } from "./document/transformation";
import { deduplicateSchemas, fixSchema } from "./schema/transformation";
import { OpenApiDocumentFragment } from "./types";

interface Arguments {
  source: string;
  output?: string;
  schema_version?: string;
  list_paths?: boolean;
}

function parseArgs(): Arguments {
  return yargs
    .scriptName("hloud-apify")
    .command(
      "--source <source> -o <output>",
      "Convert Hetzner OpenAPI spec to better OpenAPI document"
    )
    .options({
      source: {
        type: "string",
        describe: "URL or local file with OpenAPI spec in JSON",
        default: "https://docs.hetzner.cloud/cloud.spec.json",
      },
      output: {
        alias: "o",
        type: "string",
        describe: "Result file location",
      },
      schema_version: {
        type: "string",
        describe: "version number for the generated API",
      },
      list_paths: {
        type: "boolean",
        describe: "List all supported request paths",
      },
    })
    .help()
    .strict().argv;
}

async function getContents(source: string): Promise<any> {
  console.log(`Loading JSON from ${source}`);
  if (validUrl.isWebUri(source)) {
    return (await needle("get", source)).body;
  } else {
    return fs
      .readFile(source, "utf-8")
      .then((contents: string) => JSON.parse(contents));
  }
}

function toOperationId(verb: string, text: string) {
  const filtered = ["a", "an", "the"];
  let id = text
    .split(/ |-/)
    .map((part) => part.toLowerCase())
    .filter((part) => !filtered.includes(part))
    .join("_");

  // rename to fit IBM's naming convention
  id = id.replace(/^(get_all_)/, "list_");
  if (verb === "put") {
    id = id.replace(/^(update_)/, "replace_");
  }
  return id;
}

function toSchemaName(postfix: string, verb: string, summary: string): string {
  return `${toOperationId(verb.toLowerCase(), summary)}_${postfix}`;
}

function appendSchema(
  schemas: OpenApiDocumentFragment,
  id: string,
  schema: OpenApiDocumentFragment | undefined,
  description: string
) {
  if (schema === undefined) {
    return;
  }

  schemas[id] = schema;
  schemas[id].description = description;
  fixSchema(id, schemas);
}

function sortObject(
  obj: OpenApiDocumentFragment,
  compareFn?: (a: string, b: string) => number
) {
  return Object.keys(obj)
    .sort(compareFn)
    .reduce(function (result: OpenApiDocumentFragment, key) {
      result[key] = obj[key];
      return result;
    }, {});
}

function sortObjectWithList(obj: OpenApiDocumentFragment, order: string[]) {
  return sortObject(obj, (a, b) => {
    const a_index = order.indexOf(a);
    const b_index = order.indexOf(b);
    if (a_index === -1 && b_index === -1) {
      return 0;
    }
    if (a_index === -1) {
      return 1;
    }
    if (b_index === -1) {
      return -1;
    }
    return a_index - b_index;
  });
}

function sortObjectRecursive(obj: OpenApiDocumentFragment) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = sortObjectRecursive(obj[i]);
    }
    return obj;
  }

  if (typeof obj === "object") {
    for (const key of Object.keys(obj)) {
      obj[key] = sortObjectRecursive(obj[key]);
    }
    return sortObject(obj);
  }

  return obj;
}

async function createComponents(document: OpenApiDocumentFragment) {
  const paths = document.paths as OpenApiDocumentFragment;
  const base_url = "https://api.hetzner.cloud/v1";

  // const schemas = document.components.schemas ?? {};
  const schemas = {}; // all components in the original spec are currently not referenced

  for (const [path, path_obj] of Object.entries(paths)) {
    for (const [verb, verb_obj] of Object.entries(path_obj)) {
      const verb_data = verb_obj as OpenApiDocumentFragment;

      const id = toSchemaName("request", verb, verb_data.summary);
      appendSchema(
        schemas,
        id,
        verb_data?.requestBody?.content?.["application/json"]?.schema,
        `Request for ${verb.toUpperCase()} ${base_url}${path}`
      );

      for (const [status_code, response_obj] of Object.entries(
        verb_data.responses
      )) {
        const response_data = response_obj as OpenApiDocumentFragment;

        const id = toSchemaName("response", verb, verb_data.summary);
        appendSchema(
          schemas,
          id,
          response_data?.content?.["application/json"]?.schema,
          `Response to ${verb.toUpperCase()} ${base_url}${path}`
        );
      }
    }
  }

  await deduplicateSchemas(schemas, true);

  document.components = {
    ...document.components,
    schemas: sortObject(schemas),
  };
}

function tagFromPath(path: string): string {
  return path.split("/")[1];
}

function transformPath(
  path: string,
  verb: string,
  verb_data: OpenApiDocumentFragment
) {
  verb_data.tags = [tagFromPath(path)];
  verb_data.operationId = toOperationId(verb, verb_data.summary);

  const request_content = verb_data?.requestBody?.content?.["application/json"];
  if (request_content?.schema !== undefined) {
    const id = toSchemaName("request", verb, verb_data.summary);
    request_content.schema = { $ref: "#/components/schemas/" + id };
  }

  for (const [status_code, response_obj] of Object.entries(
    verb_data.responses
  )) {
    const response_data = response_obj as OpenApiDocumentFragment;
    const response_content = response_data?.content?.["application/json"];

    if (response_content?.schema !== undefined) {
      const id = toSchemaName("response", verb, verb_data.summary);
      response_content.schema = { $ref: "#/components/schemas/" + id };
    }
  }
}

async function transformPaths(document: OpenApiDocumentFragment) {
  const paths = document.paths as OpenApiDocumentFragment;

  for (const [path, path_obj] of Object.entries(paths)) {
    for (const [verb, verb_obj] of Object.entries(path_obj)) {
      transformPath(path, verb, verb_obj as OpenApiDocumentFragment);
    }
  }
}

function getVersion(): string {
  try {
    const proc = require("child_process");
    const hash = proc.execSync("git rev-parse --short HEAD").toString().trim();
    const dirty = proc.execSync("git status --short").toString().trim() !== "";
    return hash + (dirty ? "-dirty" : "");
  } catch {
    return "unknown";
  }
}

async function validateOpenApiDocument(document: OpenApiDocumentFragment) {
  console.log("Checking validity of generated document");

  const results = await validator(document);

  const filters = [
    /A paginated list operation should include a .*/,
    /Common path parameters should be defined on the path object/,
    /Enum values must be snake case/,
    /Null values are not allowed for any property/,
    /parameter must be of type string and optional/,
    /parameter should be named/,
    /Parameter should have a non-empty description/,
    /Parameters must have a name/,
    /Parameters must have a valid 'in' value/,
    /Properties with the same name have inconsistent types: .*/,
    /Response bodies should include an example response/,
    /Schema of type string should use one of the following formats/,
    /Schema property should have a non-empty description/,
    /Should define a .* for a valid string/,
  ];

  let warnings = Array.from(results.warnings).filter(
    (item) => !filters.some((regex) => item.message.match(regex))
  );

  let errors = Array.from(results.errors).filter(
    (item) => !filters.some((regex) => item.message.match(regex))
  );

  for (const item of warnings) {
    console.warn(`WARNING: ${item.message} (${item.path})`);
  }
  for (const item of errors) {
    console.error(`ERROR: ${item.message} (${item.path})`);
  }
  console.log(`Found ${warnings.length} warnings and ${errors.length} errors`);
}

function overWriteMetadata(
  document: OpenApiDocumentFragment,
  version?: string
) {
  document.openapi = "3.0.3";
  document.info = {
    title: "Hetzner Cloud API",
    description:
      "Copied from the official API documentation for the Public Hetzner Cloud.",
    contact: { url: "https://docs.hetzner.cloud/" },
    version: version === undefined ? getVersion() : version,
  };
  document.servers = [
    {
      url: "https://api.hetzner.cloud/v1",
      description: "Official production server",
    },
  ];
}

function overWriteTagList(document: OpenApiDocumentFragment) {
  const paths = document.paths as OpenApiDocumentFragment;
  const usedTags = new Set(Object.keys(paths).map(tagFromPath));

  const mapping: any = {};
  for (const tag of document.tags) {
    const canonical_name = (tag.name as string)
      .toLowerCase()
      .replace(/\s+/g, "_");
    mapping[canonical_name] = tag;
  }

  const tags = [];
  for (const name of usedTags) {
    const description = mapping[name]?.description;
    tags.push({ name, description });
  }
  document.tags = tags.sort((a, b) => a.name.localeCompare(b.name));
}

async function outputDocument(
  document: OpenApiDocumentFragment,
  output?: string
) {
  const json = JSON.stringify(document, null, 2);
  if (output === undefined) {
  } else {
    await fs.writeFile(output, json, "utf-8");
  }
}

async function main() {
  const args = parseArgs();

  try {
    // load document from source
    let document = (await getContents(args.source)) as OpenApiDocumentFragment;

    // add pagination support where it makes sense
    addPagination(document);

    // create components (and deduplicate them) and add references to components to the paths
    await createComponents(document);
    transformPaths(document);

    // apply transformations from `resources/document_transformations.json`
    await transformDocument(document);

    // overwrite various spec parts
    overWriteMetadata(document, args.schema_version);
    overWriteTagList(document);

    // keep order of paths stable
    const oldPaths = JSON.parse(
      await fs.readFile("resources/paths.json", "utf-8")
    );

    document = sortObjectRecursive(document);

    document.paths = sortObjectWithList(document.paths, oldPaths);
    const newPaths = Object.keys(document.paths);
    await fs.writeFile(
      "resources/paths.json",
      JSON.stringify(newPaths, null, 2),
      "utf-8"
    );

    document = sortObjectWithList(document, [
      "openapi",
      "info",
      "servers",
      "tags",
      "components",
      "paths",
      "security",
    ]);

    await validateOpenApiDocument(JSON.parse(JSON.stringify(document)));
    await outputDocument(document, args.output);

    if (args.list_paths) {
      Object.keys(document.paths).forEach((path) => {
        const verbs = Object.keys(document.paths[path]);
        console.log(
          `${path} (${verbs.map((verb) => verb.toUpperCase()).join(", ")})`
        );
      });
    }
  } catch (error) {
    console.error(error);
  }
}

main();
