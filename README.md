# Home Base — standalone PWA

This is the installable version of the tracker we've been building in
chat. The app itself (`src/HomeBase.jsx`) is the exact same file we edit
together there — nothing changes for it to work standalone. The only
addition is `src/storage-polyfill.js`, which gives it real on-device
storage (IndexedDB) instead of Claude's `window.storage`, which only
exists inside a Claude artifact.

This guide is written so you can stop at the end of any step and pick
back up later without losing your place.

---

## Part 1 — Get the code on GitHub

You only need to do this once.

1. Go to [github.com](https://github.com) and create a free account if you
   don't already have one.
2. Click the **+** in the top right → **New repository**.
3. Name it something like `home-base` (private or public, your choice —
   private is fine and keeps it out of public search).
4. Leave everything else default and click **Create repository**.
5. On the new (empty) repo page, click **uploading an existing file**.
6. Drag in every file and folder from this zip, keeping the folder
   structure intact (`src/`, `public/`, `package.json`, `vite.config.js`,
   `index.html`, `README.md`).
7. Scroll down, add a commit message like "Initial upload," and click
   **Commit changes**.

You should now see the full file tree in your repo. Stop here if you want
— it'll wait for you.

---

## Part 2 — Deploy it with Vercel

Vercel builds and hosts the app for you in the cloud — you don't need
Node.js or any command line on your own machine.

1. Go to [vercel.com](https://vercel.com) and sign up using your GitHub
   account (this makes this step much simpler — one click to connect).
2. From your Vercel dashboard, click **Add New** → **Project**.
3. Find and select the `home-base` repo you just created, then click
   **Import**.
4. Vercel will auto-detect this as a Vite project. Leave the build
   settings on their defaults — you shouldn't need to change anything.
5. Click **Deploy**. This takes 1–2 minutes.
6. When it finishes, you'll get a live URL like
   `home-base-yourname.vercel.app`. Open it to confirm the app loads.

If something fails at this step, copy the error text from Vercel's build
log and send it to me — it's usually a one-line fix.

---

## Part 3 — Install it on your iPhone

1. Open your Vercel URL in **Safari** (this only works in Safari, not
   Chrome or another browser).
2. Tap the **Share** icon (the square with an arrow) at the bottom.
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add** in the top right.

You'll now have a "Home Base" icon on your home screen. Tapping it opens
the app full-screen, with no browser bar, straight to the Log tab.

---

## Your data

Everything is stored locally on your phone via IndexedDB — nothing is
sent to any server, and I never see it. This also means the data lives on
that specific phone/browser only — it won't automatically match what's in
the Claude chat artifact, or sync to a second device. Use the Export tab's
JSON backup if you ever want to move data between them, or restore it if
you switch phones.

---

## Part 4 — Pushing future updates

We'll keep refining the tracker in chat the same way we have been. Any
time you want your installed app to catch up to what we've built:

1. Ask me for the refreshed `HomeBase.jsx`.
2. In your GitHub repo, open `src/HomeBase.jsx`, click the pencil (edit)
   icon, select all, paste the new version, and click **Commit changes**.
3. Since your repo is connected to Vercel, that commit automatically
   triggers a rebuild — check your Vercel dashboard for a "Building..."
   status, done within a couple minutes.
4. Fully close and reopen the app on your phone once to pick up the
   update.

There's no live sync between this chat and your deployed app — this is a
short, repeatable manual step each time we're ready to ship a round of
changes, not something that happens automatically in the background.
