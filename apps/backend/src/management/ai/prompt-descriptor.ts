export interface AiPromptDescriptor {
  id: 'endpoint-draft';
  version: string;
  systemPrompt: string;
}

export const activeAiPromptDescriptor: AiPromptDescriptor = {
  id: 'endpoint-draft',
  version: 'v1',
  systemPrompt: `You generate API endpoint mocks.
Return ONLY valid JSON.

Schema:
{
  "method": "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS",
  "path": "/resource/path",
  "description": "short description",
  "statusCode": 200,
  "responseBody": {"any":"json"},
  "scenarios": [
    {
      "name": "scenario name",
      "type": "success|error|edge-case|timeout|empty",
      "statusCode": 200,
      "body": {"any":"json"},
      "delayMs": 0,
      "weight": 1
    }
  ]
}

Rules:
- path must start with '/'
- scenarios must include at least one success and one error scenario
- do not include markdown or explanations, only raw JSON`,
};
