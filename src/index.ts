#!/usr/bin/env node
import fs = require("fs/promises");
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

interface ResponseHeaders {
  status: number;
  contentType?: string;
}

interface SectionData {
  title: string;
  description: string;
  request: Request;
  uriParameters: Parameter[];
  responseHeaders: ResponseHeaders;
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

function parseResponseHeaders(pre: Element): ResponseHeaders {
  return { status: 204, contentType: undefined }; // TODO
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

  const responseHeaders = assertElement(
    elementAfterText(methodExample, "h4", "Response headers", "pre")
  );

  return {
    valid: true,
    data: {
      title,
      description,
      request: parseRequest(request),
      uriParameters: parseParameterTable(uriParameterTable),
      responseHeaders: parseResponseHeaders(responseHeaders),
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

function toResponses(data: SectionData): OpenApiDocumentFragment {
  return {
    [data.responseHeaders.status.toString()]: {
      description: "TODO", // TODO: construct from data
    },
  };
}

function createPath(section: Section): PathVerbOperation {
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
      responses: toResponses(section.data),
    },
  };
}

function createPaths(sections: Section[]): OpenApiDocumentFragment {
  let result: OpenApiDocumentFragment = {};
  sections.forEach((section) => {
    let { path, verb, operation } = createPath(section);
    if (!(path in result)) {
      result[path] = {};
    }
    result[path][verb] = operation;
  });
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

function createOpenApiDocument(sections: Section[]): OpenApiDocumentFragment {
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

  return {
    openapi: openapi,
    info: info,
    servers: servers,
    paths: createPaths(sections),
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
    const document = createOpenApiDocument(sections);
    validateOpenApiDocument(document);

    const json = JSON.stringify(document, null, 4);
    if (args.output === undefined) {
    } else {
      fs.writeFile(args.output, json, "utf-8");
    }
  } catch (error) {
    console.error(error);
  }
}

main();
