# Memory Timeline

Memory Timeline is a full-stack web application built to store, organize, protect, and revisit personal memories through a rich visual timeline. It supports image-based memories, push reminders, favorites, hidden memories, sharing, exporting, and highly customizable viewing styles across desktop and mobile.

## Project Overview

The application is designed as a private digital memory space where users can create memories with images, dates, categories, descriptions, and reminders. Memories can be explored in multiple layouts such as timeline view, calendar view, and tile view, with user-controlled card size, border radius, themes, icon styles, sounds, appearance settings, and opt-in browser push notifications.

Memory Timeline also includes a protected hidden-images section, trash recovery flow, account management, image export, and secure media handling through backend ownership checks.

## Core Features

- Account-based memory timeline with user-specific private data
- Add, update, delete, restore, and permanently remove memories
- Multiple image support for each memory
- Image previews, full-screen viewing, carousel navigation, and zoom controls
- Timeline view, calendar view, and tile view modes
- Default memory view selection from settings
- Search, sorting, category filtering, and favorite memories
- Reminder support with in-app sounds, reminder popups, and opt-in browser push notifications
- Hidden images page protected by a mandatory 4-digit PIN
- Application password confirmation before saving or updating sensitive PIN settings
- Trash page with restore, select, empty bin, and permanent deletion flows
- Public sharing support for selected memories
- Export options for downloading memory images
- Responsive desktop and mobile layouts
- Customizable themes, card sizes, border radius, icon styles, button placement, fonts, and sounds

## Security And Privacy Features

- User authentication with protected backend routes
- Password hashing for account credentials
- Hidden-images PIN stored securely using salted hashing
- Application password confirmation for sensitive actions
- Backend ownership checks before serving protected memory images
- Cloudinary media protection using authenticated access and encrypted uploads
- Sanitized memory descriptions before storage and response
- File upload validation by type, extension, size, and image metadata
- Permanent deletion flow designed to remove memory records and associated media
- Per-device push subscriptions with validated provider endpoints and delivery records

## Tech Stack

| Layer | Technologies Used |
| --- | --- |
| Frontend | React, Vite, React Router, Framer Motion |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas with Mongoose |
| Media Storage | Cloudinary |
| Authentication | JWT, httpOnly cookies, bcryptjs |
| Image Processing | Sharp, Multer |
| Notifications | Web Push, VAPID, Service Workers, Notifications API |
| Export Handling | JSZip |
| Security Utilities | Helmet, CORS, Express Rate Limit, sanitize-html |
| Deployment | Vercel for frontend, Render for backend |

## Frontend

The frontend is built with React and Vite for a fast, responsive user experience. React Router handles navigation across timeline, profile, hidden images, trash, calendar, and memory detail pages. Framer Motion is used for smooth transitions, intro animation, timeline interactions, and polished UI movement.

The interface supports both desktop and mobile layouts with separate responsive behavior where needed, keeping the desktop experience rich while making mobile screens compact and usable.

## Backend

The backend is built with Node.js and Express.js. It handles authentication, user profiles, memories, image uploads, reminder scheduling, push subscriptions and delivery records, hidden image access, trash operations, sharing, exporting, and protected media delivery.

Backend routes are structured to ensure each user can access only their own memories and media. Sensitive operations such as hidden PIN updates and account deletion include additional password confirmation.

## Database

MongoDB Atlas is used as the cloud database. Mongoose manages application models such as users, memories, images, hidden-image settings, reminders, favorites, trash state, and account-related data.

The database stores structured memory information while image files are handled separately through Cloudinary.

## Media Storage

Cloudinary is used for storing memory images and optimized image assets. The application uses Cloudinary for uploaded memory media, thumbnails, and full-view images while keeping access controlled through the backend.

Encrypted media storage is used to reduce direct visibility of private user uploads from the media library side, while the application still serves images securely to the correct authenticated user.

## Deployment

| Part | Platform |
| --- | --- |
| Frontend | Vercel |
| Backend API | Render |
| Database | MongoDB Atlas |
| Media Storage | Cloudinary |

The frontend is deployed on Vercel, the backend service is deployed on Render, MongoDB Atlas stores application data, and Cloudinary manages image storage.

## Push Notification Setup

Reminder delivery uses browser Web Push only; reminder emails are not sent.

1. In `backend`, run `npm run generate:vapid` once and store the generated key pair securely.
2. Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` in the backend environment. Keep the private key secret and keep the same key pair across deployments.
3. Serve the app over HTTPS (or use localhost during development), then enable push notifications in Profile on each browser or device that should receive reminders.
4. On iPhone or iPad, install Memory Timeline to the Home Screen and open that installed app before enabling push notifications.

Push subscriptions are device-specific. Reminder lead time still synchronizes through the user's settings profile.

## Advantages

- Keeps personal memories organized in a visual and searchable format
- Supports multiple viewing styles for different user preferences
- Protects private hidden memories with PIN-based access
- Uses cloud storage and cloud database services for scalable deployment
- Provides responsive behavior for both desktop and mobile users
- Includes recovery-oriented trash handling before permanent deletion
- Offers export and sharing options while keeping normal memories account-protected
- Provides a polished, customizable UI suited for personal memory management