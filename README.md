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
  Gives non-coders the power of code - and takes no power away from coders
</p>

## Why Storyflow CMS?

...

## Roadmap

...

## Explore the Storyflow monorepo

The Storyflow monorepo has packages in four parent folders:

- the `apps` folder: This folder contains two apps. (1) An app that hosts the panel-specific API and builds the admin panel with Vite. (2) A [Next.js](https://nextjs.org/) app that hosts the general API and generates pages from Storyflow.
- the `cms` folder: These packages are used specifically to create the admin panel. The `admin-panel` package contains the admin panel UI, while the `services-api` contains panel-specific API endpoints (for services like collaboration, file upload, and authorization).
- the `packages` folder: These are the packages that users will install alongside their frontend app. The `react` package contains components for rendering component trees built in the Storyflow admin panel. The `api` package allows users to self-host the general API that their frontends and admin panel rely on. By self-hosting the API, users will be able to easily create custom collections with code that rely on their own business logic.
- the`core` folder: These packages contain code shared between the packages in `cms` and `packages`.

##
