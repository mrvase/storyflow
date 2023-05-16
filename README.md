<p align="center">
  <a href="https://nextjs.org">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mrvase/storyflow/main/assets/logo.png">
      <img src="https://raw.githubusercontent.com/mrvase/storyflow/main/assets/logo.png" height="256">
    </picture>
    <h3 align="center">The highly customizable headless CMS for Next.js</h3>
  </a>
</p>

<p align="center">
  Gives non-coders the power of code — takes no power away from coders
</p>

## Why Storyflow CMS?

- **Take advantage of the most powerful input field in CMS history**. Fields in Storyflow can contain anything (rich text, numbers, images, boolean values, dates, references to other fields, references to other documents, calculations, React component trees, and also lists of all these things). But restrictions can be placed on a particular field in the admin panel or with code.
- **Use your spreadsheet skills in the CMS.** Let fields reference each other and do calculations. Why do you need code to add taxes to the price? In Storyflow, you can reference another field and just multiply it with a number - or another field. Yes, you heard it right: underneath it all, your data is just one giant spreadsheet.
- **Freely structure your admin panel**. Fields are stored in documents, and documents are stored in folders. That is all the CMS knows. The rest is up to you: Create a nested folder structure like you are used to from the file system, and modify the appearance of the folder and data to match your use case.
- **Create schemas for your data - or don't**. You can freely create field templates for your data and attach them to specific folders. Then all documents in those folders are automatically assigned the template fields. But any document can also be customized with its own unique set of fields. Do as you please.
- **Visually build your React pages**. Create a document with a "URL" field to represent a specific route on your website. Create another field, and call it "Page". Add text and components to it. Preview it live as you build it. This is what it takes to build a web page! You can also create a "Layout" field to get all the benefits of nested layouts in the Next.js App Router.
- **Query your data**. When you create a folder with a template, the template fields can be queried from any other fields. You need to present the five latest blog posts on your front page? Fetch your "Blog posts" folder with a limit set to 5, and just loop over it in your React component tree. You can add filters to the query as well, even on calculated fields. Every field store its latest calculated value in the database.
- **Create statically generated dynamic routes**. Create a route with a dynamic segment and specify the values that the dynamic route segment can have. Just like you know it from Next.js. If you need it to be the slugs of your blog posts, just fetch them into the field that specifies the possible values of the route segment.
- **Connect it to as many websites as you like**. From the same admin panel, you can manage and build any number of websites with any number of component libraries.

## Get started

As of now, all of the above features are implemented, but the CMS is not yet ready for general use. An alpha version is expected to launch within months. Until then, feel free to explore the codebase as it is built.

## Explore the Storyflow monorepo

The Storyflow monorepo has packages in four parent folders:

- the `apps` folder: This folder contains two apps.
  - The [panel](https://github.com/mrvase/storyflow/tree/main/apps/panel) app, a Next.js app that hosts the panel-specific API and builds the admin panel with Vite.
  - The [web](https://github.com/mrvase/storyflow/tree/main/apps/web) app, a Next.js app that hosts the general API and generates pages from Storyflow.
- the `cms` folder: These packages are used specifically to create the admin panel.
  - The [admin-panel](https://github.com/mrvase/storyflow/tree/main/cms/admin-panel) package contains the admin panel UI
  - The [services-api](https://github.com/mrvase/storyflow/tree/main/cms/services-api) package contains panel-specific API endpoints (for services like collaboration, file upload, and authorization).
- the `packages` folder: These are the packages that users will install alongside their frontend app.
  - The [react](https://github.com/mrvase/storyflow/tree/main/packages/react) package contains components for rendering component trees built in the Storyflow admin panel.
  - The [api](https://github.com/mrvase/storyflow/tree/main/packages/api) package allows users to self-host the general API that their frontends and admin panel rely on. By self-hosting the API, users will be able to easily create custom collections with code that rely on their own business logic.
- the `core` folder: These packages contain code shared between the packages in `cms` and `packages`.
