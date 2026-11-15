# Olen 💬

**A real-time mobile messaging app built with React Native, Expo and Supabase.**

Olen is a cross-platform chat app (iOS, Android and web) with one-to-one and group messaging, voice notes, photo and video sharing, stories, and **haptic messages**, a feature I designed that lets you send a vibration pattern, such as a heartbeat, that the other person physically feels. It's built around a fast, offline-friendly experience, with messages cached on the device and synced live over Supabase Realtime.

> Built by [Pierre Touaro](https://github.com/pierretouaro). I designed and implemented the full app: mobile UI, state and hooks, local caching, and the Supabase backend (schema, SQL functions, storage and realtime).

---

## ✨ Features

### Messaging
- **Real-time chat.** Messages arrive instantly through Supabase Realtime subscriptions.
- **One-to-one and group chats**, including group settings (name, members).
- **Rich message types:** text, **voice notes** (record and play back in the app), **photos**, **videos** and **files**, all backed by Supabase Storage.
- **Haptic messages and reactions.** Send a vibration pattern (*Heartbeat*, *Excited*, *Pulse*, *Wave*) that plays on the receiver's phone, with an animated visual to match.
- **Pinned messages** and **draft messages**, so unsent text is kept for each chat.
- **Full-screen media viewer** for photos and videos.
- **Paginated history**, so long chats load quickly.

### Social
- **Stories.** Post photos and videos to a stories bar, and react to friends' stories.
- **In-app camera** for taking photos and recording video directly.
- **Contacts sync.** Finds which of your phone contacts are already on Olen, matched by normalised phone number.
- **Activity feed.** See when friends join, post a story or update their profile.
- **User profiles** with avatar, bio and status.
- **Block and report** users.

### Privacy and settings
- **Privacy controls.** Toggle read receipts, online status, typing indicators and last seen.
- **Light and dark mode** with a custom theme system and scalable sizing.
- **Data Saver mode** to cut down media downloads on mobile data.
- **Storage management.** See cache usage, clear cached messages, or wipe local data.

### Performance and UX
- **Offline-first message cache.** Messages are stored locally with **SQLite** (falling back to AsyncStorage), so chats open instantly and are readable offline.
- **Media cache** to avoid downloading the same files again.
- **Chat preloading** so conversations feel instant.
- **Smooth animations and gestures** with Reanimated and Gesture Handler (swipeable screens, staggered lists, animated messages and a custom tab bar).
- **Haptic feedback** throughout the UI.
- **FlashList** for fast, smooth scrolling through long chats.

---

## 🛠 Tech stack

| Layer | Technology |
|---|---|
| Mobile framework | **React Native 0.81** + **Expo SDK 54** (New Architecture, React Compiler) |
| Language | **TypeScript** |
| Navigation | **Expo Router** (file-based) + React Navigation |
| Backend | **Supabase**: PostgreSQL, Auth, Realtime, Storage, SQL functions |
| Local storage | **expo-sqlite**, AsyncStorage |
| Media | expo-camera, expo-image-picker, expo-audio, expo-video, expo-image |
| Animation and UI | Reanimated 4, Gesture Handler, expo-blur, expo-linear-gradient, Lucide icons |
| Device | expo-haptics, expo-contacts, expo-location |
| Builds | **EAS Build** (development, preview APK and production profiles) |

---

## 🚀 Running it locally

### Prerequisites
- **Node.js 18+** and npm
- A free **[Supabase](https://supabase.com)** project
- One of these to run the app:
  - an **Android emulator** (Android Studio) or **iOS simulator** (Xcode, macOS only), or
  - a physical phone with a **development build** (see below)

### 1. Clone and install

```bash
git clone https://github.com/pierretouaro/Olen-KamKam.git
cd Olen-KamKam
npm install
```

### 2. Add your Supabase credentials

Create a `.env` file in the project root:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

Both values are under **Supabase → Project Settings → API**.

### 3. Set up the database

The `supabase-backup/` folder holds the SQL for the backend. Run these in the **Supabase SQL Editor**:

1. `schema.sql`: tables, RLS policies and functions (profiles, conversations, participants, messages, contacts and so on)
2. Feature scripts as needed: `group_chats.sql`, `stories.sql`, `story_reactions.sql`, `voice_messages_storage.sql`, `media_storage_setup.sql`, `add_haptic_messages.sql`, `activity_tracking.sql`, `add_pagination.sql`

> The schema dump is UTF-16 encoded. If the SQL Editor won't accept it, convert it first: `iconv -f UTF-16 -t UTF-8 schema.sql > schema-utf8.sql`

Also turn on **Realtime** for the `messages` table, and create the storage buckets used for media.

### 4. Start the app

```bash
npx expo start
```

Then press **`a`** for Android or **`i`** for iOS, or **`w`** to open it in the browser.

Other scripts:

```bash
npm run android   # build and run a native Android dev build
npm run ios       # build and run a native iOS dev build
npm run web       # run in the browser
npm run lint      # ESLint
```

### Running on a real phone (development build)

Olen uses native modules (camera, SQLite, audio and video, contacts, haptics), so it runs best as a **development build** rather than in Expo Go:

```bash
npm install -g eas-cli
eas build --profile development --platform android   # or ios
```

Install the build on your phone, then run `npx expo start` and scan the QR code. To get a shareable Android APK, use `eas build --profile preview --platform android`.

---

## 🧭 How to use it

1. **Create an account.** Sign up with email, password, username, full name and phone number. Then sign in.
2. **Find people.** Open the **People** tab and allow contacts access to see which contacts already use Olen. You can also start a chat from **New Chat**.
3. **Chat.** Send text, use the mic to record a **voice note**, attach **photos, videos or files**, or send a **haptic message** to make your friend's phone pulse.
4. **Create a group.** Start a new group chat, then manage its name and members in group settings.
5. **Post a story.** Use the **Camera** tab to take a photo or video and share it to your story. Tap stories in the bar at the top of Chats to view and react.
6. **Customise.** In **Settings**, switch between light and dark mode, change privacy options (read receipts, online status, typing indicators, last seen), turn on Data Saver, and manage local storage.
7. **Check Activity** to see what friends have been up to.

---

## 📁 Project structure

```
app/                       # Screens (Expo Router, file-based routing)
├── (tabs)/                # Bottom tabs: Chats, Camera, People, Settings
├── auth/                  # Sign in / sign up
├── chat/[id].tsx          # Conversation screen
├── group-settings/[id]    # Group management
├── user/[id].tsx          # User profile
├── activity.tsx           # Activity feed
├── new-chat.tsx           # Start a new conversation
└── profile.tsx            # Your profile
components/                # Reusable UI (message bubbles, voice/video/image/file/haptic
                           #   messages, stories bar, image viewer, custom tab bar, animations)
hooks/                     # Logic hooks: realtime messages, conversations, groups, contacts,
                           #   voice recorder, haptic reactions, drafts, pins, privacy, data saver
context/                   # Auth, theme and section-filter providers
lib/                       # Supabase client, local SQLite message DB, media cache, phone utils
constants/                 # Theme tokens
supabase-backup/           # Database schema and feature SQL scripts
```

---

## 👤 Author

**Pierre Touaro**, BSc Computer Science student at Heriot-Watt University.
GitHub: [@pierretouaro](https://github.com/pierretouaro)
