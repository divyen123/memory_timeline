# Memory Timeline

Memory Timeline is a full-stack web app for keeping personal memories organized
in a private, visual timeline. Users can add moments with images, dates,
categories, reminders, favorites, hidden images, and share/export options.

## Highlights

- Account-based private timelines
- Multiple images per memory
- Search, sorting, categories, favorites, and reminders
- Hidden Images area opened with the `app/hide-image/` timeline shortcut
- Public share links for selected memories or categories
- ZIP export for memory images
- Responsive desktop and mobile UI
- Custom themes, card styles, fonts, sounds, and notification settings
- Browser push reminders for due memories

## Safety

- Auth uses httpOnly session cookies with access/refresh token rotation.
- Memory images are served through backend ownership checks.
- Cloudinary uploads can be stored encrypted when `CLOUDINARY_ENCRYPT_MEDIA` is enabled.
- Memory descriptions are sanitized with `sanitize-html` before being saved and returned.
- Hidden Images PINs are stored as salted PBKDF2 hashes for new or updated PINs.
- Uploads are validated by MIME type, extension, size, and Sharp metadata.

Cloudinary media encryption protects files at rest in Cloudinary, but it is not
end-to-end encryption because the backend holds the decryption key.

## Stack

- Frontend: React, Vite
- Backend: Node.js, Express
- Database: MongoDB Atlas
- Media storage: Cloudinary
- Frontend hosting: Vercel
- Backend hosting: Render

## Local Setup

Create local environment files:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

Install and run the backend:

```powershell
cd backend
npm install
npm start
```

Install and run the frontend in another terminal:

```powershell
cd frontend
npm install
npm run dev
```

## Environment

Backend values are documented in [backend/.env.example](backend/.env.example).
Important production values include:

- `MONGODB_URI`
- `JWT_SECRET`
- `ALLOWED_ORIGINS`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `MEDIA_ENCRYPTION_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

Frontend values are documented in [frontend/.env.example](frontend/.env.example).
Set `VITE_API_URL` to the deployed API URL, for example:

```text
https://memory-timeline-backend.onrender.com/api
```

Never commit `.env` files, private keys, deployment archives, or uploaded media.

## Deployment

Use [render.yaml](render.yaml) for the Render backend service. Store all secrets
in Render and Vercel environment settings, not in GitHub.

After deploying the backend, add the Vercel frontend URL to `ALLOWED_ORIGINS`.
After deploying the frontend, set `VITE_API_URL` to the backend `/api` URL.

Keep `MEDIA_ENCRYPTION_KEY` stable. Changing it after encrypted uploads exist
will make those files undecryptable.

## Verification

Frontend:

```powershell
cd frontend
npm run lint
npm run build
```

Backend:

```powershell
cd backend
npm test
```
