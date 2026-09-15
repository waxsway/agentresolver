import assert from "node:assert/strict";
import test from "node:test";
import { selectOpenApiOperationDocument } from "../src/lib/openapiSelect";

const spec = {
  openapi: "3.1.0",
  info: { title: "Orders API", version: "1.0.0" },
  servers: [{ url: "https://api.example.com/v1" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer" }
    },
    schemas: {
      NewOrder: {
        type: "object",
        required: ["customerId"],
        properties: { customerId: { type: "string" } }
      }
    }
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/orders/{orderId}": {
      get: {
        operationId: "getOrder",
        summary: "Get a customer order by id",
        tags: ["orders"],
        parameters: [
          {
            name: "orderId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: { "200": { description: "Order" } }
      }
    },
    "/orders": {
      get: {
        operationId: "listOrders",
        summary: "List customer orders",
        tags: ["orders"],
        responses: { "200": { description: "Orders" } }
      },
      post: {
        operationId: "createOrder",
        summary: "Create a new customer order",
        tags: ["orders"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/NewOrder" }
            }
          }
        },
        responses: { "201": { description: "Created" } }
      }
    },
    "/customers/{customerId}": {
      get: {
        operationId: "getCustomer",
        summary: "Get a customer profile",
        tags: ["customers"],
        parameters: [
          {
            name: "customerId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: { "200": { description: "Customer" } }
      }
    }
  }
};

test("selects the best OpenAPI operation for the stated goal", () => {
  const report = selectOpenApiOperationDocument(
    spec,
    "get a customer order by order id",
    "https://example.com/openapi.json"
  );

  assert.equal(report.api.operationCount, 4);
  assert.equal(report.selected?.operationId, "getOrder");
  assert.equal(report.selected?.method, "GET");
  assert.equal(report.selected?.path, "/orders/{orderId}");
  assert.equal(report.selected?.serverUrl, "https://api.example.com/v1");
  assert.equal(report.selected?.request.path[0]?.name, "orderId");
  const security = report.selected?.security[0] as { requiredSchemes?: string[] } | undefined;
  assert.equal(security?.requiredSchemes?.[0], "bearerAuth");
  assert.ok(report.selected?.score && report.selected.score > 0);
});

test("returns an execution-ready body schema for write operations", () => {
  const report = selectOpenApiOperationDocument(
    spec,
    "create a new customer order",
    "https://example.com/openapi.json"
  );

  assert.equal(report.selected?.operationId, "createOrder");
  assert.equal(report.selected?.method, "POST");
  assert.equal(report.selected?.request.body?.contentType, "application/json");
  assert.deepEqual(report.selected?.request.body?.schema, spec.components.schemas.NewOrder);
});

test("marks unrelated goals low-confidence instead of inventing a strong match", () => {
  const report = selectOpenApiOperationDocument(
    spec,
    "translate an audio recording into japanese",
    "https://example.com/openapi.json"
  );

  assert.equal(report.confidence, "low");
  assert.ok(report.warnings.some((warning) => warning.includes("No operation strongly matched")));
});
