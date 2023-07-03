import { Collection, Template, TemplateFields } from "@storyflow/api";

const MailchimpTemplate = [
  {
    name: "email",
    label: "Email",
    type: "string",
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

export const Mailchimp = {
  name: "mailchimp",
  label: "Mailchimp",
  template: MailchimpTemplate,
  hooks: {
    async onCreate({ data }) {
      data.email;
    },
    async onRead({ id }, read) {
      return {
        email: "test",
        name: "test",
        type: "test",
      };
    },
    async onReadMany({ filters, limit, offset, sort }, read) {
      return [];
    },
  },
} satisfies Collection<typeof MailchimpTemplate>;
