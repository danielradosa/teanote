# teanote 🌿

**Mindful Tea Journal & Gongfu Brewing Timer**

Teanote is a minimal, elegant web app for tea enthusiasts to log tea sessions, track infusions, and reflect on each brew. Pro users unlock AI summaries / recommendations and cloud syncing across all devices.

---

## 👨🏻‍🔧 Tech Stack

**Frontend**
- Framework: React + Vite
- Language: TypeScript
- Styling: CSS

**Backend**
- Framework: Express + NodeJS
- Language: GraphQL
- Auth: Google + Apple OAuth
- Sessions: JWT
- Payments: Lemon Squeezy
- Database: PostgreSQL

---

## ⚡️ Project Structure
```
/teanote
├─ /client                          # React frontend
│  ├─ /public                       # Static assets (images, fav, index.html)
│  ├─ /src
│  │  ├─ /components                # Reusable UI components (Timer etc.)
│  │  ├─ /pages                     # Pages (Timer, Settings, etc.)
│  │  ├─ /graphql                   # Apollo Client queries & mutations
│  │  ├─ /styles                    # Tailwind CSS + custom styles
│  │  └─ App.tsx                    # Main React component
│  │  └─ index.tsx                  # React entry point
│  └─ package.json
│
├─ /server                          # Node + GraphQL backend
│  ├─ /auth                         # OAuth
│  │  └─ passport.js
│  ├─ /graphql
│  │  ├─ schema.js                  # GraphQL type definitions
│  │  └─ resolvers.js               # GraphQL resolvers
│  ├─ /routes
│  │  └─ lemon-squeezy-webhook.js   # Webhook for payment updates
│  ├─ /utils
│  │  └─ helpers.js                 # Helper functions (JWT, validation, etc.)
│  └─ server.js                     # Express + Apollo Server entry point
│  └─ package.json
│
├─ README.md                        # Readme
└─ .gitignore
```
