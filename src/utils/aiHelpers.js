// Helper functions for AI context building and response parsing

/**
 * Build comprehensive context from diagram state for AI
 */
export function buildDiagramContext(diagramState) {
  const { tables, relationships, database, areas, notes, types, enums } = diagramState;
  
  return {
    database,
    tables: tables.map(table => ({
      name: table.name,
      fields: (table.fields || []).map(field => ({
        name: field.name,
        type: field.type,
        primaryKey: field.primary || false,
        notNull: field.notNull || false,
        unique: field.unique || false,
        increment: field.increment || false,
        comment: field.comment || "",
        default: field.default || ""
      })),
      comment: table.comment || "",
      position: table.position
    })),
    relationships: relationships.map(rel => {
      // Find the actual table names from the IDs
      const startTable = tables.find(t => t.id === rel.startTableId);
      const endTable = tables.find(t => t.id === rel.endTableId);
      
      return {
        fromTable: startTable?.name || 'unknown',
        toTable: endTable?.name || 'unknown',
        fromField: rel.startFieldId,
        toField: rel.endFieldId,
        cardinality: rel.cardinality,
        constraint: rel.constraint || 'No action',
        name: rel.name || `rel_${rel.id}`
      };
    }),
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

/**
 * Parse AI response for actionable suggestions
 */
export function parseAIResponse(response) {
  const suggestions = {
    tables: [],
    relationships: [],
    notes: [],
    optimizations: [],
    sqlQueries: [],
    general: []
  };

  // First, try to extract JSON blocks for structured suggestions
  const jsonMatches = response.match(/```json\n([\s\S]*?)\n```/g);
  if (jsonMatches) {
    for (const match of jsonMatches) {
      try {
        const jsonContent = match.replace(/```json\n/, '').replace(/\n```/, '');
        const parsed = JSON.parse(jsonContent);
        
        if (parsed.tables && Array.isArray(parsed.tables)) {
          suggestions.tables.push(...parsed.tables);
        }
        if (parsed.relationships && Array.isArray(parsed.relationships)) {
          suggestions.relationships.push(...parsed.relationships);
        }
        if (parsed.notes && Array.isArray(parsed.notes)) {
          suggestions.notes.push(...parsed.notes);
        }
      } catch (error) {
        console.error('Error parsing JSON suggestion:', error);
      }
    }
  }

  // Extract SQL code blocks
  const sqlMatches = response.match(/```sql\n([\s\S]*?)\n```/g);
  if (sqlMatches) {
    suggestions.sqlQueries = sqlMatches.map(match => 
      match.replace(/```sql\n/, '').replace(/\n```/, '')
    );
  }

  // Extract table suggestions (look for various patterns)
  const tablePatterns = [
    /(?:CREATE TABLE|Add table|Table:|suggest.*table|recommend.*table|consider.*table)\s*([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /(?:missing|add|create|suggest).*table\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /(?:you should|I recommend|consider adding).*table\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi
  ];
  
  for (const pattern of tablePatterns) {
    const matches = response.match(pattern);
    if (matches) {
      const basicTables = matches.map(match => {
        const tableName = match.replace(/(?:CREATE TABLE|Add table|Table:|suggest.*table|recommend.*table|consider.*table|missing|add|create|suggest|you should|I recommend|consider adding).*table\s*/i, '').trim();
        return {
          name: tableName,
          fields: [
            { name: 'id', type: 'INTEGER', primaryKey: true },
            { name: 'created_at', type: 'TIMESTAMP' },
            { name: 'updated_at', type: 'TIMESTAMP' }
          ],
          comment: `AI-suggested table: ${tableName}`
        };
      });
      suggestions.tables.push(...basicTables);
    }
  }

  // Extract relationship suggestions (look for specific patterns with table names)
  const relPatterns = [
    // Look for specific table-to-table relationships
    /(?:relationship|foreign key|FK|connection|link)\s*([a-zA-Z_][a-zA-Z0-9_]{2,})\s*(?:to|->|references|with)\s*([a-zA-Z_][a-zA-Z0-9_]{2,})/gi,
    /(?:suggest|recommend|consider).*relationship.*([a-zA-Z_][a-zA-Z0-9_]{2,})\s*(?:to|->|references|with)\s*([a-zA-Z_][a-zA-Z0-9_]{2,})/gi,
    /(?:you should|I recommend|consider adding).*relationship.*([a-zA-Z_][a-zA-Z0-9_]{2,})\s*(?:to|->|references|with)\s*([a-zA-Z_][a-zA-Z0-9_]{2,})/gi
  ];
  
  // Common words to exclude from table names
  const excludeWords = ['the', 'and', 'or', 'but', 'for', 'nor', 'yet', 'so', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'linked', 'connected', 'related'];
  
  for (const pattern of relPatterns) {
    const matches = response.match(pattern);
    if (matches) {
      const basicRels = matches.map(match => {
        const parts = match.split(/\s*(?:to|->|references|with)\s*/i);
        const fromTable = parts[0].replace(/(?:relationship|foreign key|FK|connection|link|suggest|recommend|consider|you should|I recommend|consider adding).*relationship\s*/i, '').trim();
        const toTable = parts[1]?.trim();
        
        // Filter out common words and ensure table names are valid
        if (excludeWords.includes(fromTable.toLowerCase()) || excludeWords.includes(toTable.toLowerCase())) {
          return null;
        }
        
        // Ensure table names are at least 2 characters and contain letters
        if (fromTable.length < 2 || toTable.length < 2 || !/[a-zA-Z]/.test(fromTable) || !/[a-zA-Z]/.test(toTable)) {
          return null;
        }
        
        return {
          fromTable: fromTable,
          toTable: toTable,
          fromField: `${fromTable.toLowerCase()}_id`,
          toField: 'id',
          cardinality: 'one_to_many',
          constraint: 'No action'
        };
      }).filter(rel => rel !== null);
      
      suggestions.relationships.push(...basicRels);
    }
  }

  // Extract note suggestions (look for patterns like "add note", "create note", "document")
  const notePatterns = [
    /(?:add|create|insert|include).*note.*(?:about|for|regarding|documenting)\s*(.+)/gi,
    /(?:add|create|insert|include).*document.*(?:about|for|regarding)\s*(.+)/gi,
    /(?:add|create|insert|include).*spec.*(?:about|for|regarding)\s*(.+)/gi,
    /(?:add|create|insert|include).*specification.*(?:about|for|regarding)\s*(.+)/gi
  ];
  
  for (const pattern of notePatterns) {
    const matches = response.match(pattern);
    if (matches) {
      const noteSuggestions = matches.map(match => {
        const content = match.replace(/(?:add|create|insert|include).*(?:note|document|spec|specification).*(?:about|for|regarding)\s*/i, '').trim();
        return {
          content: content,
          position: { x: 100, y: 100 } // Default position
        };
      });
      suggestions.notes.push(...noteSuggestions);
    }
  }

  // If no specific suggestions found, try to extract from general advice
  if (suggestions.tables.length === 0 && suggestions.relationships.length === 0 && suggestions.notes.length === 0) {
    const generalSuggestions = extractGeneralSuggestions(response);
    suggestions.tables.push(...generalSuggestions.tables);
    suggestions.relationships.push(...generalSuggestions.relationships);
  }

  return suggestions;
}

/**
 * Extract suggestions from general advice text
 */
function extractGeneralSuggestions(response) {
  const suggestions = {
    tables: [],
    relationships: [],
    notes: []
  };

  // Look for common table names mentioned in advice
  const commonTableNames = [
    'users', 'user', 'customers', 'customer', 'orders', 'order', 'products', 'product',
    'categories', 'category', 'posts', 'post', 'comments', 'comment', 'tags', 'tag',
    'sessions', 'session', 'logs', 'log', 'audit', 'audits', 'settings', 'setting',
    'profiles', 'profile', 'addresses', 'address', 'payments', 'payment',
    'inventory', 'stock', 'suppliers', 'supplier', 'employees', 'employee'
  ];

  // Look for table names in the response
  for (const tableName of commonTableNames) {
    const regex = new RegExp(`\\b${tableName}\\b`, 'gi');
    if (regex.test(response)) {
      // Only add if it's not already in suggestions
      const exists = suggestions.tables.some(t => t.name === tableName);
      if (!exists) {
        suggestions.tables.push({
          name: tableName,
          fields: [
            { name: 'id', type: 'INTEGER', primaryKey: true },
            { name: 'created_at', type: 'TIMESTAMP' },
            { name: 'updated_at', type: 'TIMESTAMP' }
          ],
          comment: `AI-suggested table based on analysis: ${tableName}`
        });
      }
    }
  }

  // Look for relationship suggestions in the text
  const relationshipKeywords = [
    'belongs to', 'has many', 'has one', 'many to many', 'one to many', 'one to one',
    'foreign key', 'reference', 'relates to', 'connected to', 'linked to'
  ];

  for (const keyword of relationshipKeywords) {
    if (response.toLowerCase().includes(keyword)) {
      // Try to extract table names around the keyword
      const context = response.toLowerCase();
      const keywordIndex = context.indexOf(keyword);
      if (keywordIndex !== -1) {
        const beforeContext = response.substring(Math.max(0, keywordIndex - 100), keywordIndex);
        const afterContext = response.substring(keywordIndex, Math.min(response.length, keywordIndex + 100));
        
        // Look for table names in the context
        for (const tableName of commonTableNames) {
          if (beforeContext.toLowerCase().includes(tableName) || afterContext.toLowerCase().includes(tableName)) {
            // This is a very basic relationship suggestion
            suggestions.relationships.push({
              fromTable: 'table1',
              toTable: tableName,
              fromField: 'table1_id',
              toField: 'id',
              cardinality: 'one_to_many',
              constraint: 'No action'
            });
          }
        }
      }
    }
  }

  // Look for note/documentation requests in the response
  const noteKeywords = [
    'spec', 'specification', 'document', 'documentation', 'note', 'notes',
    'comment', 'comments', 'description', 'explanation', 'details'
  ];
  
  for (const keyword of noteKeywords) {
    if (response.toLowerCase().includes(keyword)) {
      // Extract the context around the keyword
      const context = response.toLowerCase();
      const keywordIndex = context.indexOf(keyword);
      if (keywordIndex !== -1) {
        const beforeContext = response.substring(Math.max(0, keywordIndex - 50), keywordIndex);
        const afterContext = response.substring(keywordIndex, Math.min(response.length, keywordIndex + 100));
        
        // Create a note suggestion based on the context
        const noteContent = `Documentation: ${beforeContext.trim()} ${afterContext.trim()}`.trim();
        if (noteContent.length > 20) { // Only add if there's substantial content
          suggestions.notes.push({
            content: noteContent,
            position: { x: 100, y: 100 }
          });
        }
      }
    }
  }

  return suggestions;
}

/**
 * Validate AI-generated schema
 */
export function validateSchema(schema) {
  const errors = [];
  
  if (!schema.name || typeof schema.name !== 'string') {
    errors.push('Table name is required');
  }
  
  if (!schema.fields || !Array.isArray(schema.fields)) {
    errors.push('Table must have fields');
  } else {
    schema.fields.forEach((field, index) => {
      if (!field.name || typeof field.name !== 'string') {
        errors.push(`Field ${index + 1} must have a name`);
      }
      if (!field.type || typeof field.type !== 'string') {
        errors.push(`Field ${index + 1} must have a type`);
      }
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Convert natural language description to schema objects
 */
export function parseNaturalLanguageDescription(description) {
  const tables = [];
  const relationships = [];
  
  // Simple pattern matching for common descriptions
  const tableMatches = description.match(/(?:table|entity)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi);
  if (tableMatches) {
    tableMatches.forEach(match => {
      const tableName = match.replace(/(?:table|entity)\s+/i, '').trim();
      tables.push({
        name: tableName,
        fields: [
          { name: 'id', type: 'INTEGER', primaryKey: true },
          { name: 'created_at', type: 'TIMESTAMP' },
          { name: 'updated_at', type: 'TIMESTAMP' }
        ],
        comment: `Auto-generated from description: ${description}`
      });
    });
  }
  
  return { tables, relationships };
}

/**
 * Extract table definitions from AI response
 */
export function extractTableDefinitions(response) {
  const tables = [];
  
  // Look for CREATE TABLE statements
  const createTableRegex = /CREATE TABLE\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([\s\S]*?)\)/gi;
  let match;
  
  while ((match = createTableRegex.exec(response)) !== null) {
    const tableName = match[1];
    const fieldsText = match[2];
    
    const fields = [];
    const fieldLines = fieldsText.split(',').map(line => line.trim());
    
    fieldLines.forEach(line => {
      if (line && !line.includes('PRIMARY KEY') && !line.includes('FOREIGN KEY')) {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          fields.push({
            name: parts[0],
            type: parts[1],
            primaryKey: line.includes('PRIMARY KEY'),
            notNull: line.includes('NOT NULL')
          });
        }
      }
    });
    
    tables.push({
      name: tableName,
      fields,
      comment: `Generated from AI response`
    });
  }
  
  return tables;
}

/**
 * Build context summary for AI
 */
export function buildContextSummary(diagramContext) {
  const { tables, relationships, database } = diagramContext;
  
  let summary = `Database: ${database}\n`;
  summary += `Tables: ${tables.length}\n`;
  summary += `Relationships: ${relationships.length}\n\n`;
  
  if (tables.length > 0) {
    summary += `Tables:\n`;
    tables.forEach(table => {
      summary += `- ${table.name} (${table.fields.length} fields)\n`;
    });
  }
  
  if (relationships.length > 0) {
    summary += `\nRelationships:\n`;
    relationships.forEach(rel => {
      summary += `- ${rel.fromTable}.${rel.fromField} -> ${rel.toTable}.${rel.toField}\n`;
    });
  }
  
  return summary;
}

/**
 * Check if response contains actionable suggestions
 */
export function hasActionableSuggestions(response) {
  const actionKeywords = [
    'CREATE TABLE',
    'ADD TABLE',
    'FOREIGN KEY',
    'INDEX',
    'CONSTRAINT',
    'ALTER TABLE',
    'DROP TABLE',
    'suggest',
    'recommend',
    'add',
    'create',
    'modify',
    'optimize'
  ];
  
  return actionKeywords.some(keyword => 
    response.toLowerCase().includes(keyword.toLowerCase())
  );
}

/**
 * Format AI response for display
 */
export function formatAIResponse(response) {
  // Convert markdown-style formatting to HTML-friendly format
  let formatted = response;
  
  // Convert **bold** to <strong>bold</strong>
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Convert *italic* to <em>italic</em>
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Convert `code` to <code>code</code>
  formatted = formatted.replace(/`(.*?)`/g, '<code>$1</code>');
  
  // Convert line breaks to <br>
  formatted = formatted.replace(/\n/g, '<br>');
  
  return formatted;
}
