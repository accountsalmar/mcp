// Simulating the buildQdrantFilter function to show what it produces
const modelName = "crm.lead";
const conditions = [
  { field: "id", op: "gt" as const, value: 0 }
];

const must: object[] = [];

// Always filter by model_name
must.push({
  key: 'model_name',
  match: { value: modelName }
});

// Process the condition
const condition = conditions[0];
const { field, op, value } = condition;

if (['gt', 'gte', 'lt', 'lte'].includes(op)) {
  // This would be a range, but id is not a date field normally
  // So it would go to Qdrant range filter
  must.push({ key: field, range: { [op]: value } });
}

const qdrantFilter = { must };

console.log("Resulting Qdrant Filter:");
console.log(JSON.stringify(qdrantFilter, null, 2));
