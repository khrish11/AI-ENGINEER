import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prompts, resources, tools } from "@/mcp/registry";
import { McpPolicySchema } from "@/mcp/types";

const names = new Set<string>();
for (const tool of tools) {
  if (!tool.name || !tool.description || !tool.inputSchema) throw new Error(`Invalid MCP tool definition: ${tool.name || "<unnamed>"}`);
  if (names.has(tool.name)) throw new Error(`Duplicate MCP tool name: ${tool.name}`);
  names.add(tool.name);
  if (!McpPolicySchema.safeParse(tool.policy).success) throw new Error(`Invalid policy for MCP tool: ${tool.name}`);
  if (tool.policy === "MUTATING") throw new Error(`Mutating MCP tools are not enabled in Phase 8: ${tool.name}`);
}
const resourceUris = new Set<string>();
for (const resource of resources) {
  if (!resource.uriTemplate.startsWith("ai-engineer://")) throw new Error(`Invalid MCP resource URI: ${resource.uriTemplate}`);
  if (resourceUris.has(resource.uriTemplate)) throw new Error(`Duplicate MCP resource URI: ${resource.uriTemplate}`);
  resourceUris.add(resource.uriTemplate);
  if (!resource.description || !resource.policy) throw new Error(`Incomplete MCP resource: ${resource.uriTemplate}`);
}
for (const prompt of prompts) {
  if (!prompt.name || !prompt.description) throw new Error("Incomplete MCP prompt definition.");
}
const manifest = JSON.parse(readFileSync(resolve("mcp-manifest.json"), "utf8")) as {
  tools?: string[];
  resources?: string[];
};
const registeredToolNames = tools.map((tool) => tool.name).sort();
const manifestToolNames = [...(manifest.tools ?? [])].sort();
if (JSON.stringify(registeredToolNames) !== JSON.stringify(manifestToolNames)) {
  throw new Error(`MCP manifest drift: manifest tools do not match the registry.`);
}
const registeredResourceUris = resources.map((resource) => resource.uriTemplate).sort();
const manifestResourceUris = [...(manifest.resources ?? [])].sort();
if (JSON.stringify(registeredResourceUris) !== JSON.stringify(manifestResourceUris)) {
  throw new Error(`MCP manifest drift: manifest resources do not match the registry.`);
}
console.log(`MCP validation passed: ${tools.length} tools, ${resources.length} resources, ${prompts.length} prompts.`);
