# nextjs-fullstack template — stack notes (current, familiar Next.js 15)

Next.js 15 (App Router, `src/`) · React 18 · TypeScript · Tailwind v3 · shadcn/ui (Radix, new-york) · Prisma 6 + SQLite · zod 3 · react-hook-form 7 · recharts 2 · date-fns 3.

- DB: `import { prisma } from "@/lib/db"` (singleton). Define models in `prisma/schema.prisma`, then `bunx prisma migrate dev --name <x>` and `bunx prisma db seed`.
- UI: shadcn components in `src/components/ui` (button, card, input, label, dialog, table, tabs, progress, sonner, select, form, skeleton, badge, separator, dropdown-menu). `cn` from `@/lib/utils`.
- Mutations via **server actions**; call `revalidatePath` after writes. Validate with **zod** on the server action AND the form (react-hook-form + @hookform/resolvers).
- This is a standard current Next.js 15 app — no exotic APIs.
