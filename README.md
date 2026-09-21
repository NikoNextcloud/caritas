# Caritas Admin Panel — caritas-vitania

Next.js + Firebase admin panel за Caritas Vitania.

**Firebase проект:** `caritas-vitania`
**Auth Domain:** `caritas-vitania.firebaseapp.com`

---

## Бързо стартиране

```bash
# 1. Инсталирай пакетите
npm install

# 2. Стартирай (ключовете са вече в .env.local)
npm run dev
```

Отвори: http://localhost:3000

---

## Firebase настройка (еднократно)

### 1. Authentication — включи Email/Password
Firebase Console → Authentication → Sign-in method → Email/Password → Enable

### 2. Firestore — създай база данни
Firebase Console → Firestore Database → Create database → Europe-west

### 3. Firestore Rules — копирай от firestore.rules файла
Firebase Console → Firestore → Rules → постни съдържанието на firestore.rules

### 4. Създай първи Admin потребител

**Стъпка А** — В Firebase Console → Authentication → Add user:
- Email: твоя имейл
- Password: твоя парола

**Стъпка Б** — В Firestore → users → Add document:
- Document ID = UID от Authentication (копирай го)
```json
{
  "email": "твоя@email.com",
  "displayName": "Никол Траянова",
  "role": "admin",
  "isOnline": false,
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

---

## Деплой на Vercel

```bash
npm install -g vercel
vercel
```

Vercel автоматично чете .env.local при деплой.
Или добави ключовете ръчно в Vercel Dashboard → Settings → Environment Variables.

---

## Модули

| Модул | Route |
|---|---|
| Табло | /admin/dashboard |
| Заявки за дейности | /admin/requests |
| Бенефициенти | /admin/beneficiaries |
| Задачи | /admin/tasks |
| Работодатели | /admin/employers |
| Export CSV | /admin/export |
| Export EPAY | /admin/export-epay |
| Потребители | /admin/users |
| Нотификации | /admin/notifications |
