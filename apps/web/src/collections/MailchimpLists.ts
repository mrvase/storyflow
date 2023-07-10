import {
  Collection,
  TemplateFields,
  createFilterFn,
  createSortFn,
} from "@storyflow/api";

const MailchimpListTemplate = [
  {
    name: "name",
    label: "Navn",
    type: "string",
    useAsTitle: true,
  },
  {
    name: "id",
    label: "ID",
    type: "string",
  },
  {
    name: "category_name",
    label: "Kategori",
    type: "string",
  },
  {
    name: "list_name",
    label: "Liste",
    type: "string",
  },
  {
    name: "list_id",
    label: "Liste-ID",
    type: "string",
  },
] as const satisfies TemplateFields;

const url = `https://us6.api.mailchimp.com/3.0`;
const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const headers = {
  Authorization: `Basic ${Buffer.from(`key:${MAILCHIMP_API_KEY}`).toString(
    "base64"
  )}`,
  "Content-Type": "application/json",
};

const getAll = async () => {
  const lists = await fetch(`${url}/lists`, {
    headers,
    method: "GET",
  })
    .then((res) => res.json())
    .then((res) => res.lists as { id: string; name: string }[]);

  const categories = (
    await Promise.all(
      lists.map(async (list) => {
        return await fetch(`${url}/lists/${list.id}/interest-categories`, {
          headers,
          method: "GET",
        })
          .then((res) => res.json())
          .then((res) =>
            (res.categories as { title: string; id: string }[]).map((el) => ({
              ...el,
              list,
            }))
          );
      })
    )
  ).flat(1);

  const interests = (
    await Promise.all(
      categories.map(async (category) => {
        return await fetch(
          `${url}/lists/${category.list.id}/interest-categories/${category.id}/interests`,
          {
            headers,
            method: "GET",
          }
        )
          .then((res) => res.json())
          .then((res) =>
            (res.interests as { name: string; id: string }[]).map((el) => ({
              ...el,
              category_name: category.title,
              list_name: category.list.name,
              list_id: category.list.id,
            }))
          );
      })
    )
  ).flat(1);

  console.log("INTERESTS", interests);

  return interests;
};

export const MailchimpLists = {
  name: "mailchimp_lists",
  label: "Mailchimp: Lister",
  template: MailchimpListTemplate,
  externalData: {
    async readOne() {
      return {} as any;
    },
    async readMany({ filters, limit, offset, sort }) {
      let cursor = await getAll();

      cursor = cursor.filter(createFilterFn(filters));

      if (sort) {
        cursor.sort(createSortFn(sort));
      }

      return cursor.slice(offset, offset + limit);
    },
    async create(input) {
      return input.data;
    },
    async update() {
      return {} as any;
    },
  },
} satisfies Collection<typeof MailchimpListTemplate>;
