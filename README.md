# Nuxt 3 Minimal Starter

Look at the [Nuxt 3 documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install the dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm run dev

# yarn
yarn dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm run build

# yarn
yarn build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm run preview

# yarn
yarn preview
```

## Deployment to Netlify

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

The deployment log output of `npm run generate` on Netlify is misleading. Its build step output shows the following two lines of messages:

```
3:18:57 PM: [success] [nitro] You can preview this build using `npx serve .output/static`
3:18:57 PM: [success] You can now deploy `dist` to any static hosting!
```

It makes you think that the publish directory is `.output/static`, but it is **not the case**.

The correct build settings for Netlify is as follows:

* Build command: `npm run generate`
* Publish directory: `dist`
