import { ErrorResponse, type Container } from "@azure/cosmos";

type Doc = Record<string, unknown> & { id: string };

/**
 * A tiny in-memory stand-in for a Cosmos container, covering only what CosmosFlightStore uses:
 * point reads/deletes by (id, partition key), create, upsert, and parameterised equality queries
 * of the form `SELECT * FROM c WHERE c.a = @a AND c.b = @b`. It enforces partition scoping the
 * way Cosmos does, so tests catch a query that forgets the partition key.
 */
export function fakeContainer(partitionKeyPath: string): Container {
  const pkField = partitionKeyPath.replace(/^\//, "");
  const docs = new Map<string, Doc>();
  const key = (id: string, pk: unknown) => `${String(pk)}::${id}`;
  const withSystemFields = (d: Doc) => ({ ...d, _rid: "x", _etag: '"1"', _ts: 1 });

  const container = {
    items: {
      query(
        spec: { query: string; parameters: { name: string; value: unknown }[] },
        opts?: { partitionKey?: unknown },
      ) {
        const conditions = [...spec.query.matchAll(/c\.(\w+)\s*=\s*(@\w+)/g)].map(
          ([, field, param]) => ({
            field: field!,
            value: spec.parameters.find((p) => p.name === param)?.value,
          }),
        );
        return {
          fetchAll: async () => ({
            resources: [...docs.values()]
              .filter((d) => opts?.partitionKey === undefined || d[pkField] === opts.partitionKey)
              .filter((d) => conditions.every((c) => d[c.field] === c.value))
              .map(withSystemFields),
          }),
        };
      },
      async create(doc: Doc) {
        const k = key(doc.id, doc[pkField]);
        if (docs.has(k)) throw new ErrorResponse("Conflict");
        docs.set(k, structuredClone(doc));
        return { resource: doc };
      },
      async upsert(doc: Doc) {
        docs.set(key(doc.id, doc[pkField]), structuredClone(doc));
        return { resource: doc };
      },
    },
    item(id: string, pk: unknown) {
      return {
        async read() {
          const d = docs.get(key(id, pk));
          return { resource: d ? withSystemFields(d) : undefined, statusCode: d ? 200 : 404 };
        },
        async delete() {
          if (!docs.delete(key(id, pk))) {
            const err = new ErrorResponse("Not found");
            err.code = 404;
            throw err;
          }
          return {};
        },
      };
    },
    /** Test helper: everything stored, for asserting on raw documents. */
    _all: () => [...docs.values()],
  };
  return container as unknown as Container;
}
