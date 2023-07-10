import {
  Collection,
  TemplateFields,
  createFilterFn,
  createSortFn,
} from "@storyflow/api";

const MailchimpTemplate = [
  {
    name: "email",
    label: "Email",
    type: "string",
    useAsTitle: true,
  },
  {
    name: "name",
    label: "Navn",
    type: "string",
  },
  {
    name: "type",
    label: "Type",
    type: "string",
  },
] as const satisfies TemplateFields;

const data = [
  {
    email: "martin@rvase.dk",
    name: "Martin Rugager Vase",
    type: "test",
  },
];

export const Mailchimp = {
  name: "mailchimp",
  label: "Mailchimp",
  template: MailchimpTemplate,
  externalData: {
    async readOne() {
      return data[0];
    },
    async readMany({ filters, limit, offset, sort }) {
      const cursor = data.filter(createFilterFn(filters));

      if (sort) {
        cursor.sort(createSortFn(sort));
      }

      return cursor.slice(offset, offset + limit);
    },
    async create(input) {
      console.log("CREATING!!!", input);
      data.push(input.data);
      return input.data;
    },
    async update() {
      return {
        email: "martin@rvase.dk",
        name: "Martin Rugager Vase",
        type: "test",
      };
    },
  },
  hooks: {
    async onCreate(options, create) {
      return await create(options);
    },
    async onReadOne(options, read) {
      return await read(options);
    },
    async onReadMany(options, read) {
      return await read(options);
    },
    async onDelete(options, remove) {
      return await remove(options);
    },
  },
} satisfies Collection<typeof MailchimpTemplate>;
