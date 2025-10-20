import axios from "axios";

class LiteLLMClient {
  constructor(endpoint, apiKey, model = "gpt-3.5-turbo") {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.model = model;
    this.client = axios.create({
      baseURL: endpoint,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds timeout
    });
  }

  // Build system prompt with current diagram context
  buildSystemPrompt(diagramContext) {
    const { tables, relationships, database, areas, notes, types, enums } = diagramContext;
    
    return `You are an expert database architect and SQL specialist. You're helping users design and optimize database schemas in DrawDB, a visual database design tool.

Current diagram context:
- Database type: ${database}
- Tables: ${tables.length} tables
- Relationships: ${relationships.length} relationships
- Subject areas: ${areas.length} areas
- Notes: ${notes.length} notes
${types.length > 0 ? `- Custom types: ${types.length} types` : ''}
${enums.length > 0 ? `- Enums: ${enums.length} enums` : ''}

Current schema details:
${JSON.stringify({tables, relationships}, null, 2)}

Available capabilities:
1. Schema optimization and suggestions
2. SQL query generation and validation
3. Natural language to database schema conversion
4. Relationship analysis and recommendations
5. Index and constraint suggestions
6. Normalization advice

When suggesting changes:
- Provide actionable recommendations with specific table and relationship suggestions
- Include SQL code when relevant
- Explain the reasoning behind suggestions
- Consider the specific database type being used
- Maintain consistency with existing naming conventions
- When reviewing designs, suggest specific tables that might be missing
- When suggesting improvements, provide concrete table and relationship recommendations

IMPORTANT: When asked to "review design" or "suggest improvements", analyze the current schema and provide specific, actionable suggestions in JSON format. Look for:
- Missing tables that would improve the design
- Missing relationships between existing tables
- Tables that could be normalized or optimized
- Index suggestions for performance
- Data integrity improvements

For note requests (like "add spec document", "add note", "create documentation"), provide note suggestions in JSON format with:
- Content: The actual note text
- Position: Optional x,y coordinates for placement

For schema suggestions, provide structured JSON when applicable:
\`\`\`json
{
  "tables": [
    {
      "name": "table_name",
      "fields": [
        {
          "name": "field_name",
          "type": "VARCHAR(255)",
          "primaryKey": false,
          "notNull": true,
          "unique": false,
          "comment": "Field description"
        }
      ],
      "comment": "Table description"
    }
  ],
  "relationships": [
    {
      "fromTable": "source_table",
      "toTable": "target_table",
      "fromField": "source_field",
      "toField": "target_field",
      "cardinality": "one_to_many",
      "constraint": "CASCADE"
    }
  ],
  "notes": [
    {
      "content": "Note content for documentation",
      "position": { "x": 100, "y": 100 }
    }
  ]
}
\`\`\`

Always be helpful, accurate, and provide practical database design advice.`;
  }

  // Build context from diagram state
  buildDiagramContext(diagramState) {
    const { tables, relationships, database, areas, notes, types, enums } = diagramState;
    
    return {
      tables: tables.map(table => ({
        name: table.name,
        fields: table.fields || [],
        comment: table.comment || "",
        position: table.position
      })),
      relationships: relationships.map(rel => ({
        fromTable: rel.fromTable,
        toTable: rel.toTable,
        fromField: rel.fromField,
        toField: rel.toField,
        cardinality: rel.cardinality,
        constraint: rel.constraint
      })),
      database,
      areas: areas.map(area => ({
        name: area.name,
        color: area.color,
        position: area.position
      })),
      notes: notes.map(note => ({
        content: note.content,
        position: note.position
      })),
      types: types || [],
      enums: enums || []
    };
  }

  // Send message to LiteLLM
  async sendMessage(userMessage, diagramContext) {
    try {
      const systemPrompt = this.buildSystemPrompt(diagramContext);
      const context = this.buildDiagramContext(diagramContext);
      
      const messages = [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userMessage
        }
      ];

      const response = await this.client.post('/v1/chat/completions', {
        model: this.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000,
        stream: false
      });

      return {
        success: true,
        content: response.data.choices[0].message.content,
        usage: response.data.usage
      };
    } catch (error) {
      console.error('LiteLLM API Error:', error);
      
      if (error.response) {
        // Server responded with error status
        return {
          success: false,
          error: `API Error: ${error.response.status} - ${error.response.data?.error?.message || error.response.statusText}`,
          code: error.response.status
        };
      } else if (error.request) {
        // Network error
        return {
          success: false,
          error: "Network error: Unable to connect to LiteLLM endpoint. Please check your endpoint URL and internet connection.",
          code: 'NETWORK_ERROR'
        };
      } else {
        // Other error
        return {
          success: false,
          error: `Request error: ${error.message}`,
          code: 'REQUEST_ERROR'
        };
      }
    }
  }

  // Test connection to LiteLLM endpoint
  async testConnection() {
    try {
      const response = await this.client.post('/v1/chat/completions', {
        model: this.model,
        messages: [
          {
            role: "user",
            content: "Hello, this is a connection test."
          }
        ],
        max_tokens: 10
      });

      return {
        success: true,
        message: "Connection successful"
      };
    } catch (error) {
      console.error('Connection test failed:', error);
      
      if (error.response) {
        return {
          success: false,
          error: `Connection failed: ${error.response.status} - ${error.response.data?.error?.message || error.response.statusText}`
        };
      } else if (error.request) {
        return {
          success: false,
          error: "Connection failed: Unable to reach endpoint. Please check the URL and your internet connection."
        };
      } else {
        return {
          success: false,
          error: `Connection failed: ${error.message}`
        };
      }
    }
  }
}

export default LiteLLMClient;
