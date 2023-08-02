import { RPCError } from "@nanorpc/server";
import {
  DBDocument,
  DocumentVersionRecord,
  DocumentConfig,
  SyntaxTreeRecord,
} from "@storyflow/cms/types";
import {
  DocumentId,
  FolderId,
  FieldId,
  ValueArray,
} from "@storyflow/shared/types";
import { parseDocument } from "./convert";
import { createFetcher } from "./queries";
import { saveDocument } from "./fields/save";
import { Update } from "./fields/stages";
import { client, createObjectId } from "./mongo";
import { DBDocumentRaw } from "./types";

type Data = {
  readOne: (input: {
    id: DocumentId;
    dbName?: string;
  }) => Promise<DBDocument | undefined>;
  readMany: (input: {
    folder: FolderId;
    filters: Record<FieldId, ValueArray>;
    limit: number;
    offset: number;
    sort?: Record<string, 1 | -1>;
    dbName?: string;
  }) => Promise<DBDocument[]>;
  create: (input: {
    id: DocumentId;
    input: {
      folder: string;
      versions: Partial<DocumentVersionRecord>;
      config: DocumentConfig;
    };
    versions: DocumentVersionRecord;
    record: SyntaxTreeRecord;
    derivatives: Update[];
    isCreatedFromValues?: boolean;
    dbName?: string;
  }) => Promise<DBDocument>;
  update: (input: {
    id: DocumentId;
    input: {
      folder: string;
      versions: Partial<DocumentVersionRecord>;
      config: DocumentConfig;
    };
    versions: DocumentVersionRecord;
    record: SyntaxTreeRecord;
    derivatives: Update[];
    dbName?: string;
  }) => Promise<DBDocument>;
  deleteMany: (input: { ids: DocumentId[]; dbName?: string }) => Promise<void>;
};

export const dataFromDb: Data = {
  async readOne({ id, dbName }) {
    const db = await client.get(dbName);

    const documentRaw = await db
      .collection<DBDocumentRaw>("documents")
      .findOne({ _id: createObjectId(id) });

    if (!documentRaw) {
      const initialDoc: DBDocument = {
        _id: id as DocumentId,
        // folder: "" as FolderId,
        versions: { config: [0] },
        config: [],
        record: {},
      };
      return initialDoc;
      // return error({ message: "No article found" });
    }

    const doc = parseDocument(documentRaw);

    return doc;
  },
  async readMany({ folder, filters, limit, sort, offset, dbName }) {
    return await createFetcher(dbName)({
      folder,
      filters,
      limit,
      sort,
      offset,
    });
  },
  async create({
    id,
    record,
    derivatives,
    versions,
    input,
    isCreatedFromValues,
  }) {
    return await saveDocument({
      record,
      derivatives,
      versions,
      documentId: id,
      input,
      isCreatedFromValues,
    });
  },
  async update({ id, record, derivatives, versions, input }) {
    return await saveDocument({
      record,
      derivatives,
      versions,
      documentId: id,
      input,
    });
  },
  async deleteMany({ ids, dbName }) {
    const db = await client.get(dbName);

    const removes = ids.map((el) => createObjectId(el));

    const result = await db
      .collection<DBDocumentRaw>("documents")
      .deleteMany({ _id: { $in: removes } });

    if (!result.acknowledged) {
      throw new RPCError({
        code: "SERVER_ERROR",
        message: "Failed to delete",
      });
    }
  },
};
