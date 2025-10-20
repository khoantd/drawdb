// Functions to apply AI suggestions to the diagram
import { Action, ObjectType } from "../data/constants";

/**
 * Apply table suggestion from AI
 */
export function applyTableSuggestion(tableData, { addTable, setUndoStack, setRedoStack, t }) {
  try {
    // Validate table data
    if (!tableData.name || !tableData.fields || !Array.isArray(tableData.fields)) {
      throw new Error('Invalid table data provided');
    }

    // Create table object
    const newTable = {
      name: tableData.name,
      fields: tableData.fields.map(field => ({
        name: field.name,
        type: field.type,
        primaryKey: field.primaryKey || false,
        notNull: field.notNull || false,
        unique: field.unique || false,
        comment: field.comment || ""
      })),
      comment: tableData.comment || "",
      position: tableData.position || { x: 100, y: 100 }
    };

    // Add table using context method
    addTable(newTable);

    // Add to undo stack
    setUndoStack(prev => [
      ...prev,
      {
        action: Action.ADD,
        element: ObjectType.TABLE,
        message: t("ai_applied_table_suggestion", { tableName: newTable.name }),
        data: newTable
      }
    ]);
    setRedoStack([]);

    return { success: true, table: newTable };
  } catch (error) {
    console.error('Error applying table suggestion:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Apply relationship suggestion from AI
 */
export function applyRelationshipSuggestion(relData, { addRelationship, setUndoStack, setRedoStack, t }) {
  try {
    // Validate relationship data
    if (!relData.fromTable || !relData.toTable || !relData.fromField || !relData.toField) {
      throw new Error('Invalid relationship data provided');
    }

    // Create relationship object
    const newRelationship = {
      fromTable: relData.fromTable,
      toTable: relData.toTable,
      fromField: relData.fromField,
      toField: relData.toField,
      cardinality: relData.cardinality || "one_to_many",
      constraint: relData.constraint || "No action"
    };

    // Add relationship using context method
    addRelationship(newRelationship);

    // Add to undo stack
    setUndoStack(prev => [
      ...prev,
      {
        action: Action.ADD,
        element: ObjectType.RELATIONSHIP,
        message: t("ai_applied_relationship_suggestion", { 
          fromTable: newRelationship.fromTable,
          toTable: newRelationship.toTable 
        }),
        data: newRelationship
      }
    ]);
    setRedoStack([]);

    return { success: true, relationship: newRelationship };
  } catch (error) {
    console.error('Error applying relationship suggestion:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Apply schema optimization suggestions
 */
export function applySchemaOptimization(optimizations, { tables, setTables, setUndoStack, setRedoStack, t }) {
  try {
    const updatedTables = [...tables];
    let changesApplied = 0;

    optimizations.forEach(optimization => {
      if (optimization.type === 'add_index') {
        // Add index to table
        const tableIndex = updatedTables.findIndex(t => t.name === optimization.tableName);
        if (tableIndex !== -1) {
          if (!updatedTables[tableIndex].indexes) {
            updatedTables[tableIndex].indexes = [];
          }
          updatedTables[tableIndex].indexes.push({
            name: optimization.indexName,
            fields: optimization.fields,
            unique: optimization.unique || false
          });
          changesApplied++;
        }
      } else if (optimization.type === 'add_constraint') {
        // Add constraint to table
        const tableIndex = updatedTables.findIndex(t => t.name === optimization.tableName);
        if (tableIndex !== -1) {
          if (!updatedTables[tableIndex].constraints) {
            updatedTables[tableIndex].constraints = [];
          }
          updatedTables[tableIndex].constraints.push({
            name: optimization.constraintName,
            type: optimization.constraintType,
            fields: optimization.fields,
            expression: optimization.expression
          });
          changesApplied++;
        }
      }
    });

    if (changesApplied > 0) {
      setTables(updatedTables);
      
      // Add to undo stack
      setUndoStack(prev => [
        ...prev,
        {
          action: Action.EDIT,
          element: ObjectType.TABLE,
          message: t("ai_applied_optimizations", { count: changesApplied }),
          data: { optimizations }
        }
      ]);
      setRedoStack([]);
    }

    return { success: true, changesApplied };
  } catch (error) {
    console.error('Error applying schema optimization:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate schema from natural language description
 */
export function generateFromDescription(description, context) {
  const { addTable, addRelationship, setUndoStack, setRedoStack, t } = context;
  
  try {
    // Parse description for entities and relationships
    const entities = extractEntities(description);
    const relationships = extractRelationships(description, entities);
    
    const results = {
      tables: [],
      relationships: [],
      errors: []
    };

    // Create tables
    entities.forEach(entity => {
      const tableData = {
        name: entity.name,
        fields: entity.fields || [
          { name: 'id', type: 'INTEGER', primaryKey: true },
          { name: 'created_at', type: 'TIMESTAMP' },
          { name: 'updated_at', type: 'TIMESTAMP' }
        ],
        comment: `Generated from: ${description}`
      };

      const result = applyTableSuggestion(tableData, context);
      if (result.success) {
        results.tables.push(result.table);
      } else {
        results.errors.push(`Failed to create table ${entity.name}: ${result.error}`);
      }
    });

    // Create relationships
    relationships.forEach(rel => {
      const result = applyRelationshipSuggestion(rel, context);
      if (result.success) {
        results.relationships.push(result.relationship);
      } else {
        results.errors.push(`Failed to create relationship: ${result.error}`);
      }
    });

    return results;
  } catch (error) {
    console.error('Error generating from description:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Extract entities from natural language description
 */
function extractEntities(description) {
  const entities = [];
  
  // Simple pattern matching for common entity descriptions
  const entityPatterns = [
    /(?:create|add|make)\s+(?:a\s+)?(?:table|entity)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /([a-zA-Z_][a-zA-Z0-9_]*)\s+(?:table|entity)/gi,
    /(?:user|users|post|posts|comment|comments|product|products|order|orders|customer|customers)/gi
  ];

  entityPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(description)) !== null) {
      const entityName = match[1] || match[0];
      if (!entities.find(e => e.name === entityName)) {
        entities.push({
          name: entityName,
          fields: generateDefaultFields(entityName)
        });
      }
    }
  });

  return entities;
}

/**
 * Extract relationships from natural language description
 */
function extractRelationships(description, entities) {
  const relationships = [];
  
  // Look for relationship patterns
  const relPatterns = [
    /([a-zA-Z_][a-zA-Z0-9_]*)\s+(?:has|belongs to|references|links to)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /([a-zA-Z_][a-zA-Z0-9_]*)\s+(?:->|->>|<-|<<-)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi
  ];

  relPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(description)) !== null) {
      const fromTable = match[1];
      const toTable = match[2];
      
      if (entities.find(e => e.name === fromTable) && entities.find(e => e.name === toTable)) {
        relationships.push({
          fromTable,
          toTable,
          fromField: `${fromTable.toLowerCase()}_id`,
          toField: 'id',
          cardinality: 'one_to_many'
        });
      }
    }
  });

  return relationships;
}

/**
 * Generate default fields for an entity
 */
function generateDefaultFields(entityName) {
  const baseFields = [
    { name: 'id', type: 'INTEGER', primaryKey: true },
    { name: 'created_at', type: 'TIMESTAMP' },
    { name: 'updated_at', type: 'TIMESTAMP' }
  ];

  // Add entity-specific fields based on common patterns
  const entityLower = entityName.toLowerCase();
  if (entityLower.includes('user') || entityLower.includes('customer')) {
    baseFields.splice(1, 0, 
      { name: 'name', type: 'VARCHAR(255)', notNull: true },
      { name: 'email', type: 'VARCHAR(255)', unique: true },
      { name: 'password_hash', type: 'VARCHAR(255)' }
    );
  } else if (entityLower.includes('post') || entityLower.includes('article')) {
    baseFields.splice(1, 0,
      { name: 'title', type: 'VARCHAR(255)', notNull: true },
      { name: 'content', type: 'TEXT' },
      { name: 'author_id', type: 'INTEGER' }
    );
  } else if (entityLower.includes('product')) {
    baseFields.splice(1, 0,
      { name: 'name', type: 'VARCHAR(255)', notNull: true },
      { name: 'description', type: 'TEXT' },
      { name: 'price', type: 'DECIMAL(10,2)' },
      { name: 'stock_quantity', type: 'INTEGER' }
    );
  }

  return baseFields;
}

/**
 * Apply multiple suggestions in batch
 */
export function applyBatchSuggestions(suggestions, context) {
  const results = {
    tables: [],
    relationships: [],
    optimizations: [],
    errors: []
  };

  // Apply table suggestions
  if (suggestions.tables && suggestions.tables.length > 0) {
    suggestions.tables.forEach(tableData => {
      const result = applyTableSuggestion(tableData, context);
      if (result.success) {
        results.tables.push(result.table);
      } else {
        results.errors.push(`Table ${tableData.name}: ${result.error}`);
      }
    });
  }

  // Apply relationship suggestions
  if (suggestions.relationships && suggestions.relationships.length > 0) {
    suggestions.relationships.forEach(relData => {
      const result = applyRelationshipSuggestion(relData, context);
      if (result.success) {
        results.relationships.push(result.relationship);
      } else {
        results.errors.push(`Relationship: ${result.error}`);
      }
    });
  }

  // Apply optimizations
  if (suggestions.optimizations && suggestions.optimizations.length > 0) {
    const result = applySchemaOptimization(suggestions.optimizations, context);
    if (result.success) {
      results.optimizations.push(result);
    } else {
      results.errors.push(`Optimizations: ${result.error}`);
    }
  }

  return results;
}
