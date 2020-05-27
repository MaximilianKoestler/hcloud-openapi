#!/usr/bin/env node
const fs = require("fs").promises;

const convertSchema = require("@openapi-contrib/json-schema-to-openapi-schema");
import jsdom = require("jsdom");
import needle = require("needle");
import validator = require("ibm-openapi-validator");
import validUrl = require("valid-url");
import yargs = require("yargs");

interface Arguments {
  source: string;
  output?: string;
}

interface Request {
  verb: string;
  url: string;
}

interface Parameter {
  name: string;
  typeText: string;
  description: string;
}

interface RequestHeaders {
  contentType: string;
}

interface ResponseHeaders {
  status: number;
  contentType?: string;
}

type JsonSchema = { [property: string]: any };

interface SectionData {
  title: string;
  description: string;
  request: Request;
  uriParameters: Parameter[];
  requestHeaders?: RequestHeaders;
  requestSchema?: JsonSchema;
  responseHeaders: ResponseHeaders;
  responseSchema?: JsonSchema;
}

interface Section {
  valid: boolean;
  data?: SectionData;
}

type OpenApiDocumentFragment = { [property: string]: any };

interface PathVerbOperation {
  path: string;
  verb: string;
  operation: OpenApiDocumentFragment;
}

function assertElement(element: Element | null | undefined): Element {
  if (element === null || element === undefined) {
    throw Error(`Encountered ${element} element where it was not expected!`);
  }
  return element;
}

function parseArgs(): Arguments {
  return yargs
    .scriptName("hloud-apify")
    .command(
      "--source <source> -o <output>",
      "Convert HTML documentation to openapi format"
    )
    .options({
      source: {
        type: "string",
        describe: "URL or local file with HTML documentation",
        default: "https://docs.hetzner.cloud/",
      },
      output: {
        alias: "o",
        type: "string",
        describe: "Result file location",
      },
    })
    .help()
    .strict().argv;
}

async function getContents(source: string): Promise<string> {
  console.log(`Loading HTML documentation from ${source}`);
  if (validUrl.isWebUri(source)) {
    return (await needle("get", source)).body;
  } else {
    return fs.readFile(source, "utf-8");
  }
}

function parseRequest(request: string): Request {
  const parts = request.split(" ");
  return {
    verb: parts[0],
    url: parts[1],
  };
}

function elementAfterText(
  root: Element,
  textTag: string,
  textContent: string,
  selector: string
): Element | null {
  const possibleSearchBases = Array.from(root.querySelectorAll(textTag));
  let searchBase: Element | null | undefined = possibleSearchBases.find(
    (element) => element.textContent === textContent
  );

  const selectedElements = new Set(root.querySelectorAll(selector));
  while (searchBase !== undefined && searchBase !== null) {
    // check searchBase itself
    if (selectedElements.has(searchBase)) {
      return searchBase;
    }

    // check everything below searchBase
    const allChildrenOfSearchBase = Array.from(
      searchBase.querySelectorAll("*")
    );
    const intersection = allChildrenOfSearchBase.find((element) =>
      selectedElements.has(element)
    );
    if (intersection !== undefined) {
      return intersection;
    }

    searchBase = searchBase.nextElementSibling;
  }
  return null;
}

function consecutiveSiblings(
  element: Element | null,
  tagName: string
): Element[] {
  if (element === null) {
    return [];
  }

  let siblings: Element[] = [];
  let sibling = element.nextElementSibling;
  while (sibling?.tagName.toLowerCase() === tagName.toLowerCase()) {
    siblings.push(sibling);
    sibling = sibling.nextElementSibling;
  }
  return siblings;
}

function parseParameterTable(table: Element | null): Parameter[] {
  if (table === null) {
    return [];
  }

  return Array.from(table.querySelectorAll("tbody > tr")).map((row) => {
    const [name, typeText, description] = Array.from(
      row.querySelectorAll("td")
    ).map((td) => td.textContent?.replace(/\s+/g, " ").trim() as string);
    return { name, typeText, description };
  });
}

function parseHeaders(pre: Element): Map<string, string> {
  return new Map(
    Array.from(pre.querySelectorAll("code"))
      .map((code) => code.textContent)
      .map((line) => line?.split(": ") as [string, string])
  );
}

function parseRequestHeaders(pre: Element): RequestHeaders {
  const parts = parseHeaders(pre);

  const contentType = parts.get("Content-Type");
  if (contentType === undefined) {
    throw Error("ContentType missing from request headers!");
  }

  return {
    contentType,
  };
}

function parseResponseHeaders(pre: Element): ResponseHeaders {
  const parts = parseHeaders(pre);

  const status = parts.get("Status");
  if (status === undefined) {
    throw Error("Status missing from response headers!");
  }

  return {
    status: parseInt(status),
    contentType: parts.get("Content-Type"),
  };
}

function parseSection(section: Element): Section {
  const methodDescription = section.querySelector("div.method__description");
  if (methodDescription === null) {
    return { valid: false };
  }

  const titleElement = methodDescription.querySelector("h3");
  const title = titleElement?.textContent;
  if (title === undefined || title === null) {
    return { valid: false };
  }

  const description = consecutiveSiblings(titleElement, "p")
    .map((element) => element.textContent)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const request = elementAfterText(
    methodDescription,
    "h4",
    "HTTP Request",
    "code"
  )?.textContent;
  if (request === undefined || request === null) {
    return { valid: false };
  }

  const uriParameterTable = elementAfterText(
    methodDescription,
    "h4",
    "URI Parameters",
    "div.table-wrapper > table"
  );

  const methodExample = assertElement(
    section.querySelector("div.method__example")
  );

  const requestHeadersPre = elementAfterText(
    methodExample,
    "h4",
    "Request headers",
    "pre"
  );
  const requestHeaders =
    requestHeadersPre !== null
      ? parseRequestHeaders(requestHeadersPre)
      : undefined;

  const requestSchemaText = elementAfterText(
    methodExample,
    "h4",
    "Request",
    "div.tab__content"
  )?.nextElementSibling?.textContent;
  let requestSchema: JsonSchema =
    requestSchemaText !== undefined && requestSchemaText !== null
      ? JSON.parse(requestSchemaText)
      : undefined;

  if (requestSchema === undefined && requestHeaders !== undefined) {
    console.warn(
      `Section "${title}": Request schema is missing but contentType is present!`
    );
  }

  if (requestSchema !== undefined && requestHeaders === undefined) {
    throw Error(
      `Section "${title}": Encountered request schema for section without contentType!`
    );
  }

  const responseHeaders = parseResponseHeaders(
    assertElement(
      elementAfterText(methodExample, "h4", "Response headers", "pre")
    )
  );

  const responseSchemaText = elementAfterText(
    methodExample,
    "h4",
    "Response",
    "div.tab__content"
  )?.nextElementSibling?.textContent;
  let responseSchema: JsonSchema =
    responseSchemaText !== undefined && responseSchemaText !== null
      ? JSON.parse(responseSchemaText)
      : undefined;

  if (
    responseSchema === undefined &&
    responseHeaders.contentType !== undefined
  ) {
    console.warn(
      `Section "${title}": Response schema is missing but contentType is present!`
    );
  }

  if (
    responseSchema !== undefined &&
    responseHeaders.contentType === undefined
  ) {
    throw Error(
      `Section "${title}": Encountered response schema for section without contentType!`
    );
  }

  return {
    valid: true,
    data: {
      title,
      description,
      request: parseRequest(request),
      uriParameters: parseParameterTable(uriParameterTable),
      requestHeaders,
      requestSchema,
      responseHeaders,
      responseSchema,
    },
  };
}

function parseHtmlDocumentation(contents: string): Section[] {
  console.log(`Processing document of size ${contents.length}`);
  const dom = jsdom.JSDOM.fragment(contents);

  const sections = Array.from(dom.querySelectorAll("section.method"))
    .map(parseSection)
    .filter((section) => section.valid);

  console.log(`Found ${sections.length} valid sections`);

  return sections;
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

function toSchemaName(prefix: string, data: SectionData): string {
  return `${prefix}_${toOperationId(
    data.request.verb.toLowerCase(),
    data.title
  )}`;
}

function toParameters(data: SectionData): OpenApiDocumentFragment[] {
  let parameters: OpenApiDocumentFragment[] = [];

  data.uriParameters.forEach(({ name, typeText, description }) => {
    const required = typeText.search("(required)") !== -1;
    const inPath = data.request.url.search(`{${name}}`) !== -1;
    parameters.push({
      name,
      in: inPath ? "path" : "query",
      description,
      required,
      schema: {
        type: "string", // TODO: construct from typeText
      },
    });
  });

  return parameters;
}

function toRequestBody(data: SectionData): OpenApiDocumentFragment | undefined {
  if (data.requestHeaders === undefined || data.requestSchema === undefined) {
    return undefined;
  }

  return {
    content: {
      [data.requestHeaders.contentType]: {
        schema: {
          $ref: "#/components/schemas/" + toSchemaName("request", data),
        },
      },
    },
  };
}

function toResponses(data: SectionData): OpenApiDocumentFragment {
  const response: OpenApiDocumentFragment = {
    description: "TODO", // TODO: construct from data
  };
  if (
    data.responseSchema !== undefined &&
    data.responseHeaders.contentType !== undefined
  ) {
    response["content"] = {
      [data.responseHeaders.contentType]: {
        schema: {
          $ref: "#/components/schemas/" + toSchemaName("response", data),
        },
      },
    };
  }
  return {
    [data.responseHeaders.status.toString()]: response,
  };
}

async function createPath(section: Section): Promise<PathVerbOperation> {
  if (section.data === undefined) {
    throw Error("Encountered valid section without data!");
  }

  const data = section.data;
  const verb = data.request.verb.toLowerCase();
  const path = data.request.url
    .replace(/^(https:\/\/api.hetzner.cloud\/v1)/, "")
    .replace(/(\{\?.*)$/, "");

  return {
    path,
    verb,
    operation: {
      summary: data.title,
      description: data.description,
      operationId: toOperationId(verb, data.title),
      parameters: toParameters(section.data),
      requestBody: toRequestBody(section.data),
      responses: toResponses(section.data),
    },
  };
}

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

function applyFixes(id: string, schema: OpenApiDocumentFragment) {
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

async function appendSchema(
  schemas: OpenApiDocumentFragment,
  id: string,
  schema: OpenApiDocumentFragment | undefined
) {
  if (schema === undefined) {
    return;
  }

  schemas[id] = await convertSchema(schema, {
    dereference: true,
  });
  applyFixes(id, schemas);
}

async function appendRequestSchema(
  schemas: OpenApiDocumentFragment,
  data: SectionData
) {
  const id = toSchemaName("request", data);
  if (
    data.responseSchema !== undefined &&
    data.responseHeaders.contentType !== undefined
  ) {
    await appendSchema(schemas, id, data.requestSchema);
  }
}

async function appendResponseSchema(
  schemas: OpenApiDocumentFragment,
  data: SectionData
) {
  const id = toSchemaName("response", data);
  if (
    data.responseSchema !== undefined &&
    data.responseHeaders.contentType !== undefined
  ) {
    await appendSchema(schemas, id, data.responseSchema);
  }
}

async function createComponents(
  sections: Section[]
): Promise<OpenApiDocumentFragment> {
  const schemas = {};

  for (let i = 0; i < sections.length; ++i) {
    const data = sections[i].data;
    if (data === undefined) {
      throw Error("Encountered valid section without data!");
    }

    await appendRequestSchema(schemas, data);
    await appendResponseSchema(schemas, data);
  }

  const securitySchemes = {
    bearerAuth: {
      type: "http",
      scheme: "bearer",
    },
  };

  return {
    schemas,
    securitySchemes,
  };
}

async function createPaths(
  sections: Section[]
): Promise<OpenApiDocumentFragment> {
  let result: OpenApiDocumentFragment = {};

  for (let i = 0; i < sections.length; ++i) {
    let { path, verb, operation } = await createPath(sections[i]);
    if (!(path in result)) {
      result[path] = {};
    }
    result[path][verb] = operation;
  }
  return result;
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

async function createOpenApiDocument(
  sections: Section[]
): Promise<OpenApiDocumentFragment> {
  const openapi = "3.0.3";

  const info = {
    title: "Hetzner Cloud API",
    description:
      "Copied from the official API documentation for the Public Hetzner Cloud.",
    contact: { url: "https://docs.hetzner.cloud/" },
    version: getVersion(),
  };

  const servers = [
    {
      url: "https://api.hetzner.cloud/v1",
      description: "Official production server",
    },
  ];

  const security = [
    {
      bearerAuth: [],
    },
  ];

  return {
    openapi,
    info,
    servers,
    components: await createComponents(sections),
    paths: await createPaths(sections),
    security,
  };
}

async function validateOpenApiDocument(document: OpenApiDocumentFragment) {
  console.log("Checking validity of generated document");

  const results = await validator(document, true);

  for (const item of results.warnings) {
    console.warn(`WARNING: ${item.message} (${item.path})`);
  }
  for (const item of results.errors) {
    console.error(`ERROR: ${item.message} (${item.path})`);
  }
  console.log(
    `Found ${results.warnings.length} warnings and ${results.errors.length} errors`
  );
}

async function main() {
  const args = parseArgs();

  try {
    const contents = await getContents(args.source);
    const sections = parseHtmlDocumentation(contents);
    const document = await createOpenApiDocument(sections);
    validateOpenApiDocument(document);

    const json = JSON.stringify(document, null, 2);
    if (args.output === undefined) {
    } else {
      fs.writeFile(args.output, json, "utf-8");
    }
  } catch (error) {
    console.error(error);
  }
}

main();
