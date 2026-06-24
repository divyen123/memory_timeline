# Memory Timeline

Memory Timeline is a full-stack application for privately organizing, searching,
sharing, and exporting personal memories.

## Live Application

The production frontend is intended to run on Vercel, with the API deployed on
Render and data stored in MongoDB Atlas.

The application is deployed over HTTPS. New users can register an account and
maintain their own private collection of memories.

## Features

- Email registration and JWT authentication
- User-isolated memory timelines
- Multiple images per memory
- Search, sorting, categories, favorites, and reminders
- Private image storage through Cloudinary authenticated delivery
- Server-side encrypted Cloudinary media storage for new uploads
- Hidden image area opened with the reserved `app/hide-image/` timeline search shortcut
- Public share links for individual memories
- Original-image export with ZIP downloads for multiple images
- Permanent deletion removes stored image assets from Cloudinary when possible
- Responsive light and dark themes

## Architecture

- Frontend: React and Vite
- Backend: Node.js and Express
- Database: MongoDB Atlas
- Image storage: Cloudinary
- Frontend hosting: Vercel
- Backend hosting: Render

Authenticated memory images are streamed through the backend after ownership
checks, so browsers load Render API image routes instead of direct Cloudinary
asset URLs.

New Cloudinary uploads are encrypted before storage when
`CLOUDINARY_ENCRYPT_MEDIA` is not set to `false`. Encrypted assets are uploaded
as authenticated raw `.enc` files, which prevents normal Cloudinary Media
Library image previews. The backend decrypts them only after the requesting user
passes the normal ownership or public-share checks.

This protects media at rest in Cloudinary, but it is not full end-to-end
encryption because the backend still holds the decryption key.

## Local Development

Create local configuration files from the examples:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

Install and run the backend:

```powershell
cd backend
npm install
node server.js
```

Install and run the frontend in another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Never commit `.env` files, private keys, deployment archives, or uploaded images.

## Production Deployment

Use `render.yaml` to create the Render backend service. Add the secret values in
Render, not in GitHub:

- `MONGODB_URI`
- `ALLOWED_ORIGINS`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `MEDIA_ENCRYPTION_KEY`
- `CLOUDINARY_ENCRYPT_MEDIA`

Render generates `JWT_SECRET` automatically from the blueprint. After Render
creates the backend URL, add the Vercel frontend URL to `ALLOWED_ORIGINS`, and
set `VITE_API_URL` in Vercel to the backend API URL, for example:

```text
https://memory-timeline-backend.onrender.com/api
```

Set `MEDIA_ENCRYPTION_KEY` to a long random secret and keep it stable. Changing
that value after uploads are encrypted will make existing encrypted media
undecryptable. Keep `CLOUDINARY_ENCRYPT_MEDIA=true` for encrypted Cloudinary
storage.

Never commit `.env` files, private keys, deployment archives, or uploaded
images. Production secrets belong only in the hosting platform environment
variable manager.

## Verification

```powershell
cd frontend
npm run lint
npm run build
```
